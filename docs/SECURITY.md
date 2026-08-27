# Security model

This is the detail behind the summary in [`ARCHITECTURE.md`](ARCHITECTURE.md#security-model-summary).
Scope note up front: this describes what the prototype actually does, not a claim that it has
been independently audited or penetration-tested.

## Authentication

- Passwords are hashed with bcrypt (`BCRYPT_SALT_ROUNDS`, default 12) - see `authService.ts`.
  Plaintext passwords never touch the database or logs.
- Sessions are a short-lived JWT access token (`JWT_EXPIRES_IN`, default 8h) plus a longer-lived
  opaque refresh token (`REFRESH_TOKEN_EXPIRES_IN`, default 30d).
- Refresh tokens are 48 random bytes (`crypto.randomBytes`), never the JWT itself - only their
  SHA-256 hash is stored, so a leaked database dump doesn't hand out usable tokens. Each refresh
  **rotates**: the used token is marked revoked and a new pair is issued, so a stolen refresh
  token can only be replayed once before the legitimate user's next refresh invalidates it.
- `/api/auth/register` and `/api/auth/login` carry a tighter rate limit (20 requests / 15 min per
  IP) than the rest of the API, since credential endpoints are the highest-value brute-force
  target.
- Public self-registration (`POST /api/auth/register`) always creates a `field_operator` account.
  `validator`/`admin` accounts are never reachable through open sign-up - they're seeded
  (`apps/backend/scripts/seed.ts`) or created by an existing admin.

## Authorization

- Every privileged route is gated by `authorize(...roles)` middleware
  (`apps/backend/src/middleware/auth.ts`), checked server-side on every request. The web and
  mobile UIs also hide controls a role can't use, but that's a UX nicety, not the security
  boundary - the same 403 fires if you call the API directly with the wrong role.
- Row-level ownership is checked in addition to role: a `field_operator` can only read/act on
  their own observations and MRV records (`canAccessContributor` / `assertOwnerOrAdmin` in the
  route handlers), even though the role itself would pass `authorize()`.
- Every state-changing action - registration, login, observation creation, every MRV state
  transition, validation decisions - is written to `audit_logs` independently of the domain
  tables (`auditService.recordAuditEvent`), with actor, action, entity, and IP address. Viewing
  the log itself is validator/admin-only (`GET /api/audit`).

## Transport and HTTP hardening

- `helmet()` sets the standard security header set (CSP, `X-Content-Type-Options`,
  `X-Frame-Options`, HSTS, etc.) on every route except `/api/docs`, which is exempted because
  Swagger UI's bundle needs an inline init script that a strict `script-src 'self'` would block -
  an acceptable trade-off for a page that only renders static reference content.
- CORS is a single configured origin in production (`CORS_ORIGIN`); development relaxes this to
  any `localhost` origin/port, since the dashboard's dev server port shifts when the default is
  taken.
- A global rate limit (`RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS`, default 300 req / 15
  min per IP) applies on top of the auth-specific one above.

## File uploads

- Evidence photos are size-limited (15MB) and filtered against an image-MIME allowlist (JPEG,
  PNG, WebP, HEIC/HEIF) in `middleware/upload.ts`. Multer holds the file in memory, not on disk,
  before it's hashed and handed to the storage driver.
- **Honest limitation:** the MIME check reads the multipart part's declared `Content-Type`, not
  the file's actual magic bytes - it stops accidental wrong-type uploads, not a deliberately
  spoofed one. There's no server-side image re-encoding step, so a malformed-but-MIME-valid file
  could theoretically reach storage. Given evidence images are only ever read back by
  authenticated users (never rendered as HTML, never executed), the practical risk here is low,
  but it's a real gap if this were handling untrusted uploads at larger scale.
- Every evidence file's SHA-256 is computed server-side at upload time and used for both
  duplicate detection and the on-chain evidence hash - it's derived from the actual bytes
  received, not trusted from the client.

## Object storage

- Evidence is never served by handing the client a permanently-public URL. `GET
  /api/evidence/:id` authenticates and checks ownership first, then either streams the bytes
  itself or 302-redirects to a short-lived (15 min) presigned S3 URL - never a permanent one.
- The presigned URL's *signing* endpoint (`S3_PUBLIC_ENDPOINT`) is deliberately separate from the
  *operational* endpoint the backend uses for its own S3 calls (`S3_ENDPOINT`) - in Docker
  Compose these differ (internal `minio` hostname vs. the host's published port), since the
  browser that has to follow the redirect can't resolve the Docker-internal name. Signing is a
  local, offline cryptographic computation either way; no request is made to the public endpoint
  to produce the signature.

## Blockchain identity

- The backend holds one enrolled Fabric identity (certificate + private key, read from
  `FABRIC_CERT_DIRECTORY_PATH` / `FABRIC_KEY_DIRECTORY_PATH`) and submits all chaincode
  transactions through it via the Fabric Gateway SDK. Clients (web, mobile) never see Fabric
  credentials or talk to the peer directly - only through the backend's REST API.
- Every chaincode call is preceded by the backend's own state-machine and role checks; chaincode
  additionally re-validates the state transition itself (`_assertTransitionAllowed` in
  `mrvContract.js`) as the final authority, so a bug in the backend's own guard can't produce an
  invalid on-chain state.

## Secrets

- All secrets (`JWT_SECRET`, database credentials, S3/MinIO keys) live in `.env`, which is
  git-ignored; `.env.example` documents every variable with safe-for-local-dev-only defaults and
  is the only env file actually committed.
- `JWT_SECRET` is validated to be at least 16 characters at startup (`config/env.ts`) - the app
  refuses to boot with a trivially weak or missing secret rather than silently running insecurely.
