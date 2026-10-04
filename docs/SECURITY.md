# VYUHA security (prototype)

**Not accredited for operational use.** All operational picture data is synthetic.

## Controls in the code

- Passwords: argon2id via `argon2-cffi` (`app/security.py`).
- Access JWT (HS256) in cookie `vyuha_access`, path `/`, `HttpOnly`, `SameSite=Lax`, `Secure` when `COOKIE_SECURE` is true. Default access TTL 15 minutes.
- Refresh token in cookie `vyuha_refresh`, path `/api/v1/auth` only. Refresh rotates the session row (old row `revoked`).
- CSRF token returned to the client at login and required on mutating routes that use `CsrfUser`.
- Login: in-memory limit of 20 attempts per client address per 60 seconds (`app/routers/auth.py`). Five failed passwords set `locked_until` for 15 minutes. This limiter is process-local and resets on restart.
- `DEMO_MODE=false` refuses to boot if `JWT_SECRET` is empty or `dev-only-change-me` (`app/main.py`). Demo role cards call `POST /api/v1/auth/demo`, which returns 404 when demo mode is off.
- RBAC: `app/rbac.py` permission sets, checked with `need()` on routes. UI nav is not the enforcement point.
- Register masking: `GET /registers/threats` is emptied for roles `fleet` and `crew_officer`.
- Idle: `app/deps.py` rejects a session whose `last_seen` is older than `idle_timeout_min` (default 15). No browser warning dialog was found.
- Response headers on API responses: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `X-Request-ID`.
- Errors use `{code, message, details, request_id}`.
- Audit: append-only hash chain (`prev_hash` + SHA-256). `POST /api/v1/audit/verify` recomputes it.
- Publish: independent `validate()`, required co-sign, SHA-256 of assignment JSON stored on the plan.
- Event bodies are checked in `app/events_schema.py`. Assignment bodies are checked in `app/schemas.py`.
- Queries go through SQLAlchemy. The few raw statements are fixed `PRAGMA` / `ALTER` / `SELECT 1` strings, not user input.

`mfa_secret` exists on `users` and is never read. `pyotp` is a dependency only.

`slowapi` is listed in `services/api/pyproject.toml` and is not imported. The login limiter above is the rate limit that exists.

## Known limitations

- SQLite file on disk, no encryption at rest, no field-level encryption.
- Login rate limit is not shared across processes or hosts.
- Cookie `Secure` follows `COOKIE_SECURE`. Local demo sets it false so HTTP works.
- CORS allows `http://localhost:3000` and `http://127.0.0.1:3000` with credentials.
- Threat masking is one register, not a general field policy.
- Demo passwords and `JWT_SECRET` defaults are for local demo only.
- Web CSP is a separate Next concern (`scripts/check-offline.mjs` and `e2e/csp-production.spec.ts`). This file does not claim a nonce CSP on every route without re-reading the proxy.

## Threat model (prototype)

| Threat | What the code does |
|--------|--------------------|
| Stolen JS-readable token | Access and refresh stay in httpOnly cookies |
| Cross-site mutation | CSRF token on mutating session routes; `SameSite=Lax` |
| Password guessing | Per-process rate limit and 15-minute lockout |
| Wrong role | Server `need()` checks |
| Forged “valid” plan | Validator and digest checked at publish |
| Edited audit row | Verify endpoint recomputes the chain |
| Demo backdoor in production | `DEMO_MODE=false` returns 404 for `/auth/demo` and refuses a default JWT secret |
