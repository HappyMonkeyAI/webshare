const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const INDEX_FILE = path.join(UPLOAD_DIR, 'index.json');
const APP_PIN = process.env.APP_PIN || '';

const SESSION_COOKIE = 'webshare_session';
const sessions = new Set();

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function loadIndex() {
  try {
    const raw = fs.readFileSync(INDEX_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let index = loadIndex();

const sseClients = new Set();

function saveIndex() {
  const tmp = `${INDEX_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(index, null, 2));
  fs.renameSync(tmp, INDEX_FILE);
}

function broadcast(event, data = {}) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) res.write(payload);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, _file, cb) => cb(null, crypto.randomBytes(8).toString('hex')),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 },
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function parseCookies(header = '') {
  const cookies = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    cookies[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return cookies;
}

function pinMatches(input) {
  if (typeof input !== 'string' || !APP_PIN) return false;
  const a = crypto.createHash('sha256').update(APP_PIN).digest();
  const b = crypto.createHash('sha256').update(input).digest();
  return crypto.timingSafeEqual(a, b);
}

function sessionToken(req) {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE] || '';
}

const PUBLIC_AUTH_PATHS = new Set(['/auth', '/auth/status', '/auth/logout']);
app.use('/api', (req, res, next) => {
  if (!APP_PIN || PUBLIC_AUTH_PATHS.has(req.path)) return next();
  if (sessions.has(sessionToken(req))) return next();
  return res.status(401).json({ error: 'Authentication required.' });
});

app.get('/api/auth/status', (req, res) => {
  const token = sessionToken(req);
  res.json({
    enabled: Boolean(APP_PIN),
    authorized: !APP_PIN || sessions.has(token),
  });
});

app.post('/api/auth', (req, res) => {
  if (!APP_PIN) return res.json({ enabled: false, authorized: true });
  if (!pinMatches(req.body && req.body.pin)) {
    return res.status(401).json({ error: 'Invalid PIN.' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessions.add(token);
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/`
  );
  res.json({ enabled: true, authorized: true });
});

app.post('/api/auth/logout', (req, res) => {
  sessions.delete(sessionToken(req));
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
  );
  res.json({ enabled: Boolean(APP_PIN), authorized: false });
});

function publicMeta(entry) {
  return {
    id: entry.id,
    name: entry.name,
    size: entry.size,
    mime: entry.mime,
    uploadedAt: entry.uploadedAt,
    isImage: entry.mime.startsWith('image/'),
  };
}

function findEntry(id) {
  if (!/^[a-f0-9]{16}$/.test(id)) return null;
  return index.find((e) => e.id === id) || null;
}

app.post('/api/files', upload.array('files', 20), (req, res) => {
  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ error: 'No files received.' });
  }
  const added = files.map((f) => ({
    id: f.filename,
    name: Buffer.from(f.originalname, 'latin1').toString('utf8'),
    size: f.size,
    mime: f.mimetype,
    uploadedAt: new Date().toISOString(),
  }));
  index = added.concat(index);
  saveIndex();
  broadcast('files-changed', { count: added.length });
  res.status(201).json(added.map(publicMeta));
});

app.get('/api/files', (_req, res) => {
  res.json(index.map(publicMeta));
});

app.delete('/api/files/:id', (req, res) => {
  const entry = findEntry(req.params.id);
  if (!entry) return res.status(404).json({ error: 'File not found.' });

  const filePath = path.join(UPLOAD_DIR, entry.id);
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      return res.status(500).json({ error: 'Failed to delete file from disk.' });
    }
  }

  index = index.filter((e) => e.id !== entry.id);
  saveIndex();
  broadcast('files-changed', { deleted: 1 });
  res.status(204).end();
});

app.get('/api/files/:id', (req, res) => {
  const entry = findEntry(req.params.id);
  if (!entry) return res.status(404).json({ error: 'File not found.' });

  const filePath = path.join(UPLOAD_DIR, entry.id);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File data missing on disk.' });
  }

  const encodedName = encodeURIComponent(entry.name).replace(/'/g, '%27');
  const asciiName = entry.name
    .replace(/[\r\n"\\]/g, '')
    .replace(/[^\x20-\x7E]/g, '_')
    .slice(0, 200) || 'download';
  const disposition = req.query.download === '1' ? 'attachment' : 'inline';
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`
  );
  res.setHeader('Content-Type', entry.mime);
  res.setHeader('Content-Length', entry.size);
  fs.createReadStream(filePath).pipe(res);
});

app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('event: connected\ndata: {}\n\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: err.message });
  }
  if (err) {
    return res.status(500).json({ error: 'Unexpected server error.' });
  }
  res.status(404).json({ error: 'Not found.' });
});

app.listen(PORT, HOST, () => {
  console.log(`WebShare running at http://${HOST}:${PORT}`);
});

const heartbeat = setInterval(() => {
  for (const res of sseClients) res.write(': ping\n\n');
}, 25000);
heartbeat.unref();
