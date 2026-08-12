import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 3123;
const BASE = `http://127.0.0.1:${PORT}`;
const uploadDir = mkdtempSync(path.join(tmpdir(), 'webshare-test-'));

const server = spawn(process.execPath, [path.join(root, 'server.js')], {
  env: { ...process.env, PORT: String(PORT), UPLOAD_DIR: uploadDir },
  stdio: 'ignore',
});

async function waitForServer() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/files`);
      if (res.ok) return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('Server did not start in time');
}

try {
  await waitForServer();

  const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const textContent = 'hello from the api test';

  const form = new FormData();
  form.append('files', new Blob([imageBytes], { type: 'image/png' }), 'pic.png');
  form.append('files', new Blob([textContent], { type: 'text/plain' }), 'notes ü.txt');

  const uploadRes = await fetch(`${BASE}/api/files`, { method: 'POST', body: form });
  assert.equal(uploadRes.status, 201, 'upload returns 201');
  const uploaded = await uploadRes.json();
  assert.equal(uploaded.length, 2, 'both files are acknowledged');
  assert.equal(uploaded[1].name, 'notes ü.txt', 'non-ASCII filename survives upload');
  const image = uploaded.find((f) => f.name === 'pic.png');
  const note = uploaded.find((f) => f.name === 'notes ü.txt');
  assert.ok(image.isImage && !note.isImage, 'isImage flag follows mime type');

  const listRes = await fetch(`${BASE}/api/files`);
  const list = await listRes.json();
  assert.ok(list.length >= 2, 'list contains the uploaded files');
  assert.ok(
    new Date(list[0].uploadedAt).getTime() >= new Date(list[1].uploadedAt).getTime(),
    'list is sorted newest first'
  );

  const previewRes = await fetch(`${BASE}/api/files/${image.id}`);
  assert.equal(previewRes.headers.get('content-type'), 'image/png');
  assert.match(previewRes.headers.get('content-disposition'), /^inline/);
  const previewBytes = new Uint8Array(await previewRes.arrayBuffer());
  assert.deepEqual(previewBytes, imageBytes, 'preview content matches upload');

  const downloadRes = await fetch(`${BASE}/api/files/${note.id}?download=1`);
  const disposition = downloadRes.headers.get('content-disposition');
  assert.match(disposition, /^attachment/, 'download uses attachment disposition');
  assert.match(disposition, /filename\*=UTF-8''notes%20%C3%BC\.txt/, 'RFC 5987 filename is encoded');
  assert.equal(await downloadRes.text(), textContent, 'download content matches upload');

  const missingRes = await fetch(`${BASE}/api/files/${'0'.repeat(16)}`);
  assert.equal(missingRes.status, 404, 'unknown id returns 404');

  const traversalRes = await fetch(`${BASE}/api/files/..%2f..%2fserver.js`);
  assert.equal(traversalRes.status, 404, 'path traversal is rejected');

  const emptyRes = await fetch(`${BASE}/api/files`, { method: 'POST', body: new FormData() });
  assert.equal(emptyRes.status, 400, 'empty upload is rejected');

  console.log('PASS: api test — upload, list, preview, download, encoding, 404s');
} finally {
  server.kill('SIGTERM');
  rmSync(uploadDir, { recursive: true, force: true });
}
