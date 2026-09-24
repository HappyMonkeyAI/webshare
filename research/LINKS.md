# Research — external references

Only links worth keeping: URL, license, stack, take/avoid. No prose unless
it's an observation that saves future time.

| Topic | URL | License | Stack | Take / avoid |
| ----- | --- | ------- | ----- | ------------ |
| Express 5 | https://expressjs.com/ | MIT | Node HTTP | Routing + middleware as used in `server.js`; keep final error handler |
| Multer 2 | https://github.com/expressjs/multer | MIT | multipart | Handles uploads; latin1 filenames need UTF-8 re-decode |
| Server-Sent Events | https://developer.mozilla.org/en-US/docs/Web/API/Server-Sent_Events | CC-BY-SA | web | Push pattern for `/api/events`; heartbeat + reconnect fallback |
| Bootstrap 5 | https://getbootstrap.com/docs/5.3/ | MIT | CSS/JS | Vendored in `public/vendor/`; dark/light via `data-bs-theme` |
| RFC 5987 (filenames) | https://datatracker.ietf.org/doc/html/rfc5987 | — | HTTP | `filename*=UTF-8''` for Unicode download names |
| jsdom | https://github.com/jsdom/jsdom | MIT | Node DOM | Powers `test/frontend-smoke.mjs`; stub browser APIs |