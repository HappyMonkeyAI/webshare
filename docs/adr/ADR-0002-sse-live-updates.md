# ADR-0002: SSE + poll fallback for live updates

Status: Active

## Context

Multiple people watch the same "Recent files" list from different devices.
A manual refresh was not acceptable; changes must appear without user action.

## Decision

- `GET /api/events` is a Server-Sent Events stream. Every index mutation
  (upload, delete) calls `broadcast('files-changed', …)` to all connected
  clients. A 25 s `: ping` comment keeps connections alive.
- The frontend also polls `/api/files` every 15 s and only re-renders when
  the visible name list changed (cheap safety net for missed/disconnected
  streams).

## Consequences

- Cross-device updates appear within milliseconds; polls cover the gaps.
- SSE is same-origin, so no CORS/auth plumbing needed on the LAN.
- Every future mutation of the index must remember to broadcast — this is
  every index mutation must broadcast the update so connected clients stay in sync.

## Alternatives

- WebSockets: more plumbing than needed; SSE is one-way and sufficient.
- Poll-only: simpler but laggy and chatty.