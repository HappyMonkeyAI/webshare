# WebShare — Plan

Status: Living. Update as scope changes.

## Direction

Keep WebShare a small, dependency-light, single-node LAN file sharer. Avoid
feature creep that adds state, accounts, or network complexity. When a change
touches more than ~3 files, write the spec/report first (Agents Protocol §6).

## Phases

### Phase 1 — Core (done)
- Static frontend + upload/list/download API.
- Thumbnails, modal preview, relative times.
- 5 GB upload limit, Unicode-safe downloads.

### Phase 2 — Live & rich UX (done)
- SSE push + 15 s poll fallback so everyone sees updates.
- Arrow-key and button navigation between files in the details view.
- File delete from list and details view (server `DELETE` endpoint).
- Clipboard paste (images and files) feeds the existing upload path.

### Phase 3 — Hardening & polish (current)
- [ ] Confirm the delete UX on the LAN from a second device.
- [ ] Test uploads of very large files (progress bar, 5 GB limit path).
- [ ] Decide on max list length / pruning policy for the index.
- [ ] Sweep lint/type-check conventions into AGENTS.md if a linter is added.

### Phase 4 — Optional backlog (parked, not committed)
- Per-file share links / QR codes.
- Sub-folders or tags.
- Optional basic access token (only if the app leaves trusted LANs).

## Working agreements

- Feature branches `ag/...`, Conventional Commits, commit on green tests
  (Ratchet).
- Verify before done; run `npm test` on every change.
- Keep README, SPEC, CONTEXT, and ADRs in sync with code.