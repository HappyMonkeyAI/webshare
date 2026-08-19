# WebShare — Task Board

Living checklist. Check off items as they complete; move next steps from
PLAN.md backlog into here when they become actionable.

## In progress

- [ ] Phase 3 hardening (see PLAN.md): second-device delete check, big-file test, index pruning policy.

## Done

- [x] Upload via drag & drop and file picker, multiple files, progress bar.
- [x] Recent files list with thumbnails, sizes, relative times.
- [x] Modal details: image preview, hover + footer download, metadata.
- [x] SSE live refresh + 15 s poll fallback.
- [x] Arrow-key / button navigation between files in details view.
- [x] Delete from list (red cross) and details view (Delete button), with confirmation.
- [x] Clipboard paste (Ctrl+V) uploads images and files.
- [x] Non-ASCII and Unicode-safe filenames on download (RFC 5987).
- [x] 5 GB per-file upload limit.
- [x] Path-traversal and unknown-id rejection.
- [x] Automated tests: jsdom frontend smoke + end-to-end API suite.

## Backlog (parked)

- [ ] Per-file share links / QR codes.
- [ ] Sub-folders or tags.
- [ ] Optional access token (only if leaving trusted LANs).