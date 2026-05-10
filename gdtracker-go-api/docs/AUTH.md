# Auth, CSRF, CORS (Spring parity → Go)

## Spring sources (read-only reference)

| Concern | Primary files |
|--------|-----------------|
| Login / register / logout / me | [`gdtracker-api/.../AuthController.java`](../../gdtracker-api/src/main/java/com/example/api/controller/AuthController.java) |
| Security filter chain, CSRF exemptions, session persistence | [`SecurityConfig.java`](../../gdtracker-api/src/main/java/com/example/api/security/SecurityConfig.java) |
| CSRF JSON for SPA priming | [`CsrfController.java`](../../gdtracker-api/src/main/java/com/example/api/controller/CsrfController.java) |
| CORS allowed origin patterns | [`CorsConfig.java`](../../gdtracker-api/src/main/java/com/example/api/config/CorsConfig.java) |
| Validation → 400 | [`ValidationExceptionHandler.java`](../../gdtracker-api/src/main/java/com/example/api/controller/ValidationExceptionHandler.java) |
| User passwords (plaintext dev encoder) | [`PlainTextPasswordEncoder.java`](../../gdtracker-api/src/main/java/com/example/api/security/PlainTextPasswordEncoder.java) |
| Ingest token hash (BCrypt) | [`GameIngestTokenService.java`](../../gdtracker-api/src/main/java/com/example/api/service/GameIngestTokenService.java) |

## Session flow (Spring)

1. `POST /api/auth/login` or `POST /api/auth/register` succeeds → `SecurityContext` saved via `HttpSessionSecurityContextRepository` → **HTTP session** cookie **`JSESSIONID`** (Servlet default).
2. Subsequent browser requests send `Cookie: JSESSIONID=...`.
3. **Binary compatibility** with a Java-serialized Spring session is **not** required for migration: the SPA only stores the opaque cookie. After cutover to Go, users **re-login** once; the Go server issues its own `JSESSIONID` value encoding (`gorilla/sessions` + `securecookie`).

## CSRF (Spring)

- Repository: `CookieCsrfTokenRepository.withHttpOnlyFalse()`, path `/`, optional cookie domain from `gdtracker.cookie-domain`.
- Cookie name **`XSRF-TOKEN`** (readable by JS).
- Header **`X-XSRF-TOKEN`** must equal the cookie value (double-submit) for mutating requests protected by CSRF.
- `CsrfTokenRequestAttributeHandler` (Spring 6): header carries the **raw** token string (same as cookie), not XOR with session id.
- Exempt: `OPTIONS /api/**`, `POST` login/register, listed ingest `POST` paths (see `SecurityConfig`).

## CORS (Spring)

- `GDTRACKER_CORS_ALLOWED_ORIGINS` → comma-separated patterns for `setAllowedOriginPatterns` on `/api/**`.
- Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD.
- Headers: `*`, credentials **true**.

## Go implementation choices

| Topic | Choice |
|-------|--------|
| Sessions | `github.com/gorilla/sessions` `CookieStore`, session name **`JSESSIONID`**, keys from `GDTRACKER_SESSION_SECRET` (hashed to 32-byte pairs). |
| User passwords | **Plaintext** store/compare to match `PlainTextPasswordEncoder` (dev parity). |
| Ingest tokens | `golang.org/x/crypto/bcrypt` (cost 10) for verify + generate helpers (Phase 2 routes). |
| CSRF | Manual cookie + header check in middleware; `GET /api/csrf` returns `{"token":"..."}` and sets cookie. |
| CORS | Custom middleware: reflect `Origin` when it matches an allowed pattern (exact or simple `*` segment for ports). |

## Environment

See [`README.md`](README.md) and [`.env.example`](../.env.example).

## Security note

Plaintext passwords match Spring’s current dev encoder only—**replace with bcrypt** before production (coordinate with DB migration for existing `users.password` rows).
