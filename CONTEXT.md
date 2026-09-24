# WebShare — Project Context

For humans and contributors. Read this (plus README.md) at the start of a
task. Keep it in sync with the code.

## What this is

A dependency-light LAN file-sharing web app. A Node/Express server serves a
static single-page frontend and a small REST API. Uploaded files live in
`uploads/`; their metadata lives in `uploads/index.json`. No database, no
accounts, no cloud.

## Stack

| Layer | Choice |
| ----- | ------ |
| Runtime | Node.js 18+ (tested on 22) |
| Server | Express 5, Multer 2 (multipart), plain `fs` |
| Frontend | Vanilla JS (IIFE, no build step), Bootstrap 5, bootstrap-icons |
| Transport | Fetch/XHR, Server-Sent Events (`/api/events`) |
| Tests | Node's built-in test-style scripts: `test/api.mjs`, `test/frontend-smoke.mjs` (jsdom) |

No build step, no bundler, no TypeScript.

## Commands

- `npm start` — run on port 9000 (reads `.env`; exported `PORT` wins).
- `npm test` — frontend smoke test, then API test against a throwaway server.
- `.env` — local env overrides (see `.gitignore`; never commit).

## Layout

- `server.js` — all server logic (routes, index, SSE, error handling).
- `public/index.html` — single page + modal markup.
- `public/js/app.js` — all client logic.
- `public/css/style.css` — custom styles on top of Bootstrap.
- `public/vendor/` — vendored Bootstrap/bootstrap-icons assets.
- `uploads/` — file blobs (id = filename) + `index.json` metadata.
- `test/` — `api.mjs`, `frontend-smoke.mjs`.
- `docs/adr/` — architecture decision records.

## Architecture decisions (details in `docs/adr/`)

1. **File-id storage with JSON index** (`ADR-0001`): blobs named by random hex
   id; `index.json` holds metadata. Simple, no DB, easy to inspect/reset.
2. **SSE + poll fallback for live updates** (`ADR-0002`): push on change,
   15 s poll as safety net; keeps all clients in sync across devices.
3. **Optional PIN lock via `.env`** (`ADR-0004`): when `APP_PIN` is set, every
   `/api/*` route requires a memory-held session cookie; the client shows a
   lock screen. Supersedes the old "no auth at all" stance (ADR-0003).
4. **No user accounts — trusted LAN only** (`ADR-0003`, superseded): the PIN
   gate is a convenience lock, not real authentication.

## What NOT to do

- Do **not** add user accounts, roles, or real authentication. The only access
  control is the optional `APP_PIN` gate (see ADR-0004); a PIN is a
  convenience lock, not security — never market it as auth.
- Do **not** put secrets or the PIN in tracked files; `.env` is gitignored
  (it was untracked to avoid committing the PIN). Use `.env.example` for docs.
- Do **not** add a database, ORM, or cache. `index.json` is the datastore.
- Do **not** introduce a build step or bundler; the frontend is plain JS.
- Do **not** re-invent upload handling: Multer is already wired with a 5 GB
  limit and hex-id naming.
- Do **not** break the SSE contract: every index mutation must `broadcast('files-changed', ...)`.
- Do **not** trust raw ids: `findEntry` only accepts `/^[a-f0-9]{16}$/`.
- Do **not** disable or gut the test suite; keep `npm test` green.

## Known constraints / gotchas

- Frontend is served from the same origin; no CORS config needed.
- SSE has a 25 s heartbeat; clients should also tolerate disconnects.
- `uploads/` and `resource-sentinel.db` are untracked artifacts; the latter is
  not part of the app.
- Filenames arrive as latin1 from Multer; `server.js` converts to UTF-8.