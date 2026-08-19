# WebShare — Specification

Status: Living. Keep in sync with the implemented code.

## Overview

WebShare is a single-node LAN file-sharing web app. A user drops files into
the browser, and anyone on the same network can preview and download them.
No accounts, no cloud — just a local server exposing a small REST API and a
static single-page frontend.

## Goals

- Zero-friction upload: drag & drop, click-to-browse, or paste from clipboard.
- Instant visibility: other people's uploads appear without a manual refresh.
- Preview images and download any file with its original name.
- Keep the whole thing dependency-light and runnable with `npm start`.

## Non-goals

- User accounts, roles, or real authentication (trusted LAN only). The
  optional `APP_PIN` gate is a convenience lock, not security.
- Multi-node sync or a database (metadata lives in `uploads/index.json`).
- Editing, renaming, or sharing links per-file.
- Any cloud storage or persistence beyond the uploads directory.

## Functional requirements

| ID | Requirement |
| -- | ----------- |
| F1 | Upload one or more files (max 20 per request, 5 GB each). |
| F2 | Upload via drag & drop, a file picker, or clipboard paste (Ctrl+V). |
| F3 | List recent files newest-first with thumbnail/icon, size, relative time. |
| F4 | Live-update the list via Server-Sent Events on any upload/delete; 15 s poll fallback. |
| F5 | Show file details in a modal: image preview, size, type, upload time. |
| F6 | Download with the original (including Unicode) filename. |
| F7 | Delete a file from the list (red cross) or from the details view, after confirmation. |
| F8 | Navigate between files in the details view with buttons or arrow keys. |
| F9 | Report upload progress and errors to the user. |
| F10 | Survive a restart: index and files persist on disk. |
| F11 | Optional PIN lock: when `APP_PIN` is set in `.env`, require a correct PIN before list, details, downloads, uploads, or SSE are accessible; show a lock screen until unlocked. |

## API surface

| Method | Path | Purpose | Success |
| ------ | ---- | ------- | ------- |
| POST | `/api/files` | Multipart upload (field `files`, ≤20) | 201 + metadata array |
| GET | `/api/files` | List files newest-first | 200 + metadata array |
| GET | `/api/files/:id` | Serve file; `?download=1` for attachment | 200 stream |
| DELETE | `/api/files/:id` | Delete index entry + disk file | 204 |
| GET | `/api/auth/status` | `{ enabled, authorized }` (always public) | 200 |
| POST | `/api/auth` | Unlock with `{ "pin": "…" }`; sets session cookie | 200 |
| POST | `/api/auth/logout` | Invalidate session, clear cookie | 200 |
| GET | `/api/events` | SSE stream (`files-changed`, heartbeat) | 200 |

File metadata: `id`, `name`, `size`, `mime`, `uploadedAt`, `isImage`.

When `APP_PIN` is set, all `/api/*` routes except the three `/api/auth*`
paths require a valid `webshare_session` cookie (401 otherwise). When unset,
auth is disabled entirely and `/api/auth/status` reports
`{ enabled: false, authorized: true }`.

## Non-functional requirements

- Node.js 18+ (tested on 22); Express 5, Multer, vanilla JS + Bootstrap 5.
- Bind `0.0.0.0`, port 9000 (reserved in the launcher registry).
- Ids are 16-hex random tokens; reject anything else (path-traversal safe).
- Errors: JSON `{ "error": "..." }` with 4xx/5xx as appropriate.
- No external secrets or credentials required.