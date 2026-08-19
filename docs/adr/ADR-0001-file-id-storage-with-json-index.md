# ADR-0001: File-id storage with JSON index

Status: Active

## Context

WebShare needed somewhere to store uploaded blobs and their metadata without
introducing a database or external service.

## Decision

- Each upload is written to `uploads/<16-hex-random>` (the id) by Multer's
  diskStorage; no original filename or extension on disk.
- Metadata (id, name, size, mime, uploadedAt) lives in `uploads/index.json`,
  loaded at boot, mutated in memory, saved atomically (`*.tmp` + rename).

## Consequences

- Simple, inspectable, resettable by deleting `uploads/`.
- Id doubles as filename, so a strict id regex (`/^[a-f0-9]{16}$/`) makes
  path traversal and injection non-issues.
- Index rewrites are synchronous and O(n) per mutation — fine at this scale.
- A crash between blob write and index save can orphan a file; acceptable.

## Alternatives

- SQLite/Postgres: rejected — adds a dependency for single-node scale.
- Original-name-on-disk: rejected — collisions, traversal risk, encoding pain.