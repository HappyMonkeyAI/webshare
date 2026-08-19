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

const LOCK_PORT = 3124;
const LOCK_BASE = `http://127.0.0.1:${LOCK_PORT}`;
const lockDir = mkdtempSync(path.join(tmpdir(), 'webshare-lock-test-'));
const lockServer = spawn(process.execPath, [path.join(root, 'server.js')], {
  env: { ...process.env, PORT: String(LOCK_PORT), UPLOAD_DIR: lockDir, APP_PIN: '4242' },
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

async function waitForLockServer() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`${LOCK_BASE}/api/auth/status`);
      if (res.ok) return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('Lock server did not start in time');
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

  const delForm = new FormData();
  delForm.append('files', new Blob([textContent], { type: 'text/plain' }), 'to-delete.txt');
  const delUploadRes = await fetch(`${BASE}/api/files`, { method: 'POST', body: delForm });
  assert.equal(delUploadRes.status, 201, 'delete-test upload succeeds');
  const [toDelete] = await delUploadRes.json();

  const delRes = await fetch(`${BASE}/api/files/${toDelete.id}`, { method: 'DELETE' });
  assert.equal(delRes.status, 204, 'delete returns 204');
  assert.equal(
    await (await fetch(`${BASE}/api/files/${toDelete.id}`)).status,
    404,
    'deleted file no longer resolves'
  );
  const afterDelList = await (await fetch(`${BASE}/api/files`)).json();
  assert.ok(
    !afterDelList.some((f) => f.id === toDelete.id),
    'deleted file is removed from the list'
  );
  const delMissingRes = await fetch(`${BASE}/api/files/${'0'.repeat(16)}`, { method: 'DELETE' });
  assert.equal(delMissingRes.status, 404, 'deleting an unknown id returns 404');

  const emptyRes = await fetch(`${BASE}/api/files`, { method: 'POST', body: new FormData() });
  assert.equal(emptyRes.status, 400, 'empty upload is rejected');

  const sseAbort = new AbortController();
  const sseRes = await fetch(`${BASE}/api/events`, { signal: sseAbort.signal });
  assert.equal(sseRes.status, 200, 'sse endpoint is reachable');
  assert.match(sseRes.headers.get('content-type') || '', /text\/event-stream/, 'sse content type');

  const sseReader = sseRes.body.getReader();
  const decoder = new TextDecoder();
  let sseText = '';
  const sseRead = (async () => {
    try {
      for (;;) {
        const { value, done } = await sseReader.read();
        if (done) return;
        sseText += decoder.decode(value, { stream: true });
        if (sseText.includes('files-changed')) return;
      }
    } catch {
      // aborted after the assertions below
    }
  })();

  const sseForm = new FormData();
  sseForm.append('files', new Blob([textContent], { type: 'text/plain' }), 'sse-notice.txt');
  const sseUpload = await fetch(`${BASE}/api/files`, { method: 'POST', body: sseForm });
  assert.equal(sseUpload.status, 201, 'upload after sse connect succeeds');

  await Promise.race([
    sseRead,
    new Promise((_, reject) => setTimeout(() => reject(new Error('SSE broadcast timed out')), 5000)),
  ]);
  sseAbort.abort();
  assert.ok(sseText.includes('event: connected'), 'sse connection event received');
  assert.ok(sseText.includes('event: files-changed'), 'sse files-changed event received');

  await waitForLockServer();
  assert.equal((await fetch(`${LOCK_BASE}/api/files`)).status, 401, 'unauthenticated list is rejected');
  const lockStatus = await (await fetch(`${LOCK_BASE}/api/auth/status`)).json();
  assert.deepEqual(lockStatus, { enabled: true, authorized: false }, 'status reports locked without a session');

  const wrongPin = await fetch(`${LOCK_BASE}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '0000' }),
  });
  assert.equal(wrongPin.status, 401, 'wrong PIN is rejected');

  const loginRes = await fetch(`${LOCK_BASE}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '4242' }),
  });
  assert.equal(loginRes.status, 200, 'correct PIN unlocks');
  const cookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];
  assert.match(cookie, /^webshare_session=[a-f0-9]{64}$/, 'session cookie is a hex token');
  const authedHeaders = { Cookie: cookie };

  const authedList = await fetch(`${LOCK_BASE}/api/files`, { headers: authedHeaders });
  assert.equal(authedList.status, 200, 'authenticated list request succeeds');
  const afterLoginStatus = await (
    await fetch(`${LOCK_BASE}/api/auth/status`, { headers: authedHeaders })
  ).json();
  assert.deepEqual(afterLoginStatus, { enabled: true, authorized: true }, 'status reports authorized with a session');

  const lockForm = new FormData();
  lockForm.append('files', new Blob([textContent], { type: 'text/plain' }), 'locked.txt');
  const lockedUpload = await fetch(`${LOCK_BASE}/api/files`, {
    method: 'POST',
    body: lockForm,
    headers: authedHeaders,
  });
  assert.equal(lockedUpload.status, 201, 'authenticated upload succeeds');
  const [lockedFile] = await lockedUpload.json();
  const lockedDownload = await fetch(`${LOCK_BASE}/api/files/${lockedFile.id}?download=1`, {
    headers: authedHeaders,
  });
  assert.equal(lockedDownload.status, 200, 'authenticated download succeeds');
  assert.equal(
    (await fetch(`${LOCK_BASE}/api/files/${lockedFile.id}?download=1`)).status,
    401,
    'unauthenticated download is rejected'
  );

  const logoutRes = await fetch(`${LOCK_BASE}/api/auth/logout`, {
    method: 'POST',
    headers: authedHeaders,
  });
  assert.equal(logoutRes.status, 200, 'logout succeeds');
  const afterLogout = await (await fetch(`${LOCK_BASE}/api/auth/status`)).json();
  assert.deepEqual(afterLogout, { enabled: true, authorized: false }, 'session is invalidated by logout');

  console.log('PASS: api test — upload, list, preview, download, encoding, 404s, delete, pin lock');
} finally {
  server.kill('SIGTERM');
  lockServer.kill('SIGTERM');
  rmSync(uploadDir, { recursive: true, force: true });
  rmSync(lockDir, { recursive: true, force: true });
}
