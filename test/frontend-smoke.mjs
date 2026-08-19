import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const appJs = readFileSync(path.join(root, 'public', 'js', 'app.js'), 'utf8');

const fixtures = [
  {
    id: 'aaaa1111bbbb2222',
    name: 'photo.png',
    size: 2048,
    mime: 'image/png',
    uploadedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    isImage: true,
  },
  {
    id: 'cccc3333dddd4444',
    name: 'report.pdf',
    size: 1048576,
    mime: 'application/pdf',
    uploadedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    isImage: false,
  },
];

let modalShown = 0;
let modalHidden = 0;
let fetchedUrls = [];
let deleteCalled = null;
let sentForms = [];
const sseHandlers = new Map();

const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;

window.confirm = () => true;
window.alert = () => {};

window.bootstrap = {
  Modal: class {
    show() {
      modalShown += 1;
    }

    hide() {
      modalHidden += 1;
    }
  },
};

window.EventSource = class {
  constructor(url) {
    fetchedUrls.push(String(url));
  }

  addEventListener(type, cb) {
    sseHandlers.set(type, cb);
  }
};

window.fetch = (url, opts = {}) => {
  fetchedUrls.push(String(url));
  if (opts.method === 'DELETE') {
    deleteCalled = String(url);
    return Promise.resolve({ ok: true, status: 204 });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(fixtures),
  });
};

window.XMLHttpRequest = class {
  constructor() {
    this.upload = { addEventListener() {} };
  }

  open() {}

  addEventListener() {}

  send(formData) {
    sentForms.push(formData);
  }
};

window.eval(appJs);

await new Promise((resolve) => window.setTimeout(resolve, 50));

const list = window.document.getElementById('file-list');
assert.equal(list.children.length, 2, 'renders one list item per file');

const firstItem = list.children[0];
assert.ok(firstItem.querySelector('img.file-thumb'), 'image file renders a thumbnail');
assert.ok(firstItem.querySelector('.file-name').textContent, 'photo.png');
assert.ok(/2 KB/.test(firstItem.textContent), 'shows formatted size');
assert.ok(/min ago/.test(firstItem.textContent), 'shows relative time');

const secondItem = list.children[1];
assert.ok(secondItem.querySelector('.type-icon .bi-file-earmark-pdf'), 'pdf renders type icon');

const emptyState = window.document.getElementById('empty-state');
assert.ok(emptyState.classList.contains('d-none'), 'empty state hidden when files exist');

const refreshBtn = window.document.getElementById('refresh-btn');
const fetchCountBeforeRefresh = fetchedUrls.filter((u) => u === '/api/files').length;
refreshBtn.click();
await new Promise((resolve) => window.setTimeout(resolve, 50));
assert.ok(
  fetchedUrls.filter((u) => u === '/api/files').length > fetchCountBeforeRefresh,
  'refresh button re-fetches the file list'
);

const fetchCountBeforeSse = fetchedUrls.filter((u) => u === '/api/files').length;
assert.ok(
  sseHandlers.has('files-changed'),
  'app subscribes to SSE files-changed events'
);
sseHandlers.get('files-changed')();
await new Promise((resolve) => window.setTimeout(resolve, 50));
assert.ok(
  fetchedUrls.filter((u) => u === '/api/files').length > fetchCountBeforeSse,
  'SSE files-changed event triggers a list refresh'
);

firstItem.querySelector('button.file-item-btn').click();
assert.equal(modalShown, 1, 'clicking a file opens the modal');
assert.equal(
  window.document.getElementById('file-modal-title').textContent,
  'photo.png',
  'modal title is the file name'
);
assert.ok(
  !window.document.getElementById('preview-wrap').classList.contains('d-none'),
  'image preview is visible for images'
);
assert.equal(
  window.document.getElementById('download-btn').getAttribute('href'),
  '/api/files/aaaa1111bbbb2222?download=1',
  'download button points at the download endpoint'
);
assert.equal(
  window.document.getElementById('preview-download-btn').getAttribute('href'),
  '/api/files/aaaa1111bbbb2222?download=1',
  'overlay download button points at the download endpoint'
);

secondItem.querySelector('button.file-item-btn').click();
assert.equal(modalShown, 2, 'clicking a second file reopens the modal');
assert.ok(
  window.document.getElementById('preview-wrap').classList.contains('d-none'),
  'image preview hidden for non-images'
);
assert.ok(
  !window.document.getElementById('preview-placeholder').classList.contains('d-none'),
  'placeholder shown for non-images'
);
assert.ok(
  window.document.getElementById('placeholder-icon').classList.contains('bi-file-earmark-pdf'),
  'placeholder uses the type icon'
);

const prevBtn = window.document.getElementById('prev-file-btn');
const nextBtn = window.document.getElementById('next-file-btn');
assert.ok(!prevBtn.disabled, 'previous enabled when a newer file exists');
assert.ok(nextBtn.disabled, 'next disabled on the oldest file');

prevBtn.click();
assert.equal(
  window.document.getElementById('file-modal-title').textContent,
  'photo.png',
  'previous navigates to the newer file'
);
assert.ok(prevBtn.disabled, 'previous disabled on the newest file');
assert.ok(!nextBtn.disabled, 'next enabled when an older file exists');
assert.equal(
  window.document.getElementById('download-btn').getAttribute('href'),
  '/api/files/aaaa1111bbbb2222?download=1',
  'download link follows navigation'
);
assert.ok(
  !window.document.getElementById('preview-wrap').classList.contains('d-none'),
  'image preview shown after navigating to an image'
);

nextBtn.click();
assert.equal(
  window.document.getElementById('file-modal-title').textContent,
  'report.pdf',
  'next navigates back to the older file'
);

assert.ok(
  list.children[0].querySelector('button.file-delete-btn'),
  'each list item has a delete button'
);

const listDeleteBtn = list.children[0].querySelector('button.file-delete-btn');
listDeleteBtn.click();
await new Promise((resolve) => window.setTimeout(resolve, 50));
assert.equal(
  deleteCalled,
  '/api/files/aaaa1111bbbb2222',
  'list delete button issues a DELETE request for that file'
);
assert.equal(list.children.length, 1, 'deleted file is removed from the list');

const remainingItem = list.children[0];
assert.equal(
  remainingItem.querySelector('.file-name').textContent,
  'report.pdf',
  'the remaining file is still listed'
);

remainingItem.querySelector('button.file-item-btn').click();
assert.equal(modalShown, 3, 'remaining file still opens in the modal');
window.document.getElementById('delete-btn').click();
await new Promise((resolve) => window.setTimeout(resolve, 50));
assert.equal(
  deleteCalled,
  '/api/files/cccc3333dddd4444',
  'modal delete button issues a DELETE request for the open file'
);
assert.equal(modalHidden, 1, 'modal closes after deleting the open file');
assert.equal(list.children.length, 0, 'list is empty after deleting the last file');
assert.ok(
  !window.document.getElementById('empty-state').classList.contains('d-none'),
  'empty state is shown after the last file is deleted'
);

const pastedFile = new window.File(['pasted-bytes'], 'pasted.png', { type: 'image/png' });
const pasteEvent = new window.Event('paste', { bubbles: true, cancelable: true });
Object.defineProperty(pasteEvent, 'clipboardData', {
  value: { files: [pastedFile] },
});
window.document.dispatchEvent(pasteEvent);
await new Promise((resolve) => window.setTimeout(resolve, 50));
assert.equal(sentForms.length, 1, 'pasting a file triggers an upload');
const [pasteForm] = sentForms;
assert.ok(pasteForm.has('files'), 'pasted file is added to the upload form');
assert.equal(pasteForm.get('files').name, 'pasted.png', 'pasted file keeps its name');

window.close();
console.log('PASS: frontend smoke test — list rendering, refresh, modal, previews, download links, delete, paste');
