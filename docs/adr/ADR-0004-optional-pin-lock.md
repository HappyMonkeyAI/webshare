# ADR-0004: Optional PIN lock via `.env`

Status: Active

## Context

WebShare is open to the whole LAN by design (ADR-0003), but the owner wanted
a simple way to keep casual visitors out — a gate before the home page, file
details, downloads, and uploads — configured from the environment, with no
user management.

## Decision

- `APP_PIN` env var (in `.env`). Unset/empty → lock disabled (prior behavior).
  Set → a PIN is required.
- Server-side enforcement: a middleware guards all `/api/*` routes (files,
  uploads, downloads, SSE) except `/api/auth`, `/api/auth/status`,
  `/api/auth/logout`. Unauthenticated → `401 { "error": … }`.
- Sessions: on correct PIN, the server issues a random 32-byte hex token held
  in an in-memory `Set` and sets an `HttpOnly; SameSite=Lax` cookie.
  Logout deletes the token and clears the cookie. Sessions do not survive a
  restart (acceptable on a LAN).
- Timing-safe PIN compare (`crypto.timingSafeEqual` over SHA-256 digests).
- Client UX: the app shell loads, checks `/api/auth/status`, and shows a
  full-screen lock overlay with a PIN form until unlocked. List, details,
  downloads, uploads, and paste are gated behind the overlay and re-lock if
  a request returns 401.
- `.env` was untracked from git so the PIN can never be committed.

## Consequences

- Zero cost when disabled; one env var when enabled.
- A PIN is a convenience lock, not strong auth: short PINs are brute-forceable
  and sessions live in memory only. Documented as such in README/SPEC.
- Every API consumer (including SSE) now needs the cookie; EventSource sends
  it automatically on the same origin.
- The static app shell remains public — it contains no data; everything
  sensitive is behind the API gate.

## Alternatives

- Real auth (passwords/users): rejected — out of scope, adds drag (ADR-0003).
- Basic auth (HTTP): rejected — ugly browser prompt, no logout control.
- Client-only lock: rejected — trivially bypassed; enforcement is server-side.