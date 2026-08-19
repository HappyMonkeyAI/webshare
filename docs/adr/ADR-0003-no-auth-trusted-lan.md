# ADR-0003: No authentication — trusted LAN only

Status: Superseded by ADR-0004 (optional PIN lock)

## Context

WebShare runs on a private network where the user deliberately wants the
lowest possible friction: drop a file, everyone sees it. Adding accounts or
tokens would trade away the core value proposition.

## Decision

- No authentication, authorization, or encryption of the app itself.
- The README states the trust boundary explicitly ("intended for trusted
  local networks only").
- Config remains minimal: `PORT`, `HOST`, `UPLOAD_DIR` only.

## Consequences

- Anyone on the network can upload, download, or delete — by design.
- The app must not be exposed to the public internet as-is.
- If the app ever leaves the LAN, revisit with an optional access token
  (tracked in PLAN.md backlog), not a full user system.

## Alternatives

- Full auth (passwords/users): rejected — out of scope, adds drag.
- Reverse-proxy layer auth: out of scope for this single-file app.