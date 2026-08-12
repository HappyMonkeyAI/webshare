# WebShare

Simple file sharing for your local network. Drag & drop files into the browser,
share the URL, and anyone on the LAN can preview and download them.

## Requirements

- Node.js 18+ (tested on Node 22)

## Quick start

```sh
npm install
npm start
```

Then open **http://<server-address>:9000** from any device on the network.

The server binds to `0.0.0.0` so all LAN devices can reach it. Make sure port
3000 is allowed through the host firewall (e.g. `sudo ufw allow 3000/tcp` if
UFW is enabled).

## Configuration

Environment variables:

| Variable      | Default            | Purpose                        |
| ------------- | ------------------ | ------------------------------ |
| `PORT`        | `3000`             | Port to listen on              |
| `HOST`        | `0.0.0.0`          | Interface to bind              |
| `UPLOAD_DIR`  | `./uploads`        | Where uploaded files are kept  |

Example: `PORT=8080 npm start`

## Features

- Drag & drop or click-to-browse uploads (multiple files at once), with a
  progress bar
- Recent files list with thumbnails, sizes, and relative upload times
  (auto-refreshes every 15 s so other people's uploads show up)
- Click any file for details: image preview with a hover download button in
  the corner, plus a Download button with file info underneath
- Original filenames are preserved on download (including Unicode names)
- Max upload size: 5 GB per file

## Tests

```sh
npm test
```

Runs a jsdom frontend smoke test (list rendering, modal, download links) and
an end-to-end API test against a throwaway server instance.

## Notes

- No authentication — intended for trusted local networks only.
- Uploaded files live in `uploads/` with an `index.json` metadata index.
  Deleting both restores a fresh state.
