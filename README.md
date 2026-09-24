# WebShare

Simple file sharing for your local network. Drag & drop files into the browser,
share the URL, and anyone on the LAN can preview and download them.

## Requirements

- Node.js 22.9+ (tested on Node 22)

## Quick start

```sh
npm install
npm start
```

Then open `http://<server-address>:9000` from another device on the same
network, replacing `<server-address>` with the address of the machine running
WebShare.

The server binds to `0.0.0.0` so all LAN devices can reach it. Make sure port
9000 is allowed through the host firewall (e.g. `sudo ufw allow 9000/tcp` if
UFW is enabled).

## Configuration

Environment variables:

| Variable      | Default            | Purpose                        |
| ------------- | ------------------ | ------------------------------ |
| `PORT`        | `9000` (via `.env`)| Port to listen on              |
| `HOST`        | `0.0.0.0`          | Interface to bind              |
| `UPLOAD_DIR`  | `./uploads`        | Where uploaded files are kept  |
| `APP_PIN`     | *(unset)*          | Optional PIN lock. Set to e.g. `1234` to require a PIN before the list, details, downloads, or uploads are accessible |

`npm start` loads `.env` automatically; an exported `PORT` still overrides it
(e.g. `PORT=8080 npm start`).

See `.env.example` for a template. **`.env` is not tracked in git** — set your
PIN there, not in a committed file.

## Features

- Drag & drop or click-to-browse uploads (multiple files at once), with a
  progress bar
- Recent files list with thumbnails, sizes, and relative upload times
  (auto-refreshes via Server-Sent Events the moment anyone uploads, so other
  people's files appear without a manual reload; a 15 s poll acts as a fallback)
- Click any file for details: image preview with a hover download button in
  the corner, plus a Download button with file info underneath
- Use the left/right arrows (or arrow keys) in the details view to jump
  between files and download them without returning to the list
- Delete files from the list (red cross next to each name) or from the
  details view (Delete button), with a confirmation prompt
- Paste images or files from the clipboard (Ctrl+V) anywhere on the page to
  upload them
- Optional PIN lock: set `APP_PIN` in `.env` and visitors must enter it
  before the file list, details, downloads, or uploads are accessible
- Original filenames are preserved on download (including Unicode names)
- Max upload size: 5 GB per file

## Tests

```sh
npm test
```

Runs a jsdom frontend smoke test (list rendering, modal, download links) and
an end-to-end API test against a throwaway server instance.

## Notes

- No user accounts — intended for trusted local networks only. An optional
  `APP_PIN` gate (see Configuration) is a convenience lock, not strong auth;
  use it to keep casual visitors out, not to protect against a determined
  attacker. Sessions are memory-only and cleared on restart.
- Uploaded files live in `uploads/` with an `index.json` metadata index.
  Deleting both restores a fresh state.
