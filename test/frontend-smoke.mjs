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
let fetchedUrls = [];

const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;

window.bootstrap = {
  Modal: class {
    show() {
      modalShown += 1;
    }
  },
};

window.fetch = (url) => {
  fetchedUrls.push(String(url));
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(fixtures),
  });
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

window.close();
console.log('PASS: frontend smoke test — list rendering, refresh, modal, previews, download links');
