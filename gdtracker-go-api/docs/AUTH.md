# Auth, CSRF, CORS (Spring parity → Go)

## Auth modes

| `AUTH_MODE` | Use case | Mechanism |
|-------------|----------|-----------|
| `session` (default) | Local dev / Docker | Cookie `JSESSIONID` + CSRF double-submit |
| `auth0` | Production | Auth0 access token (`Authorization: Bearer`) validated via JWKS |

Set on the Go API:

```bash
AUTH_MODE=session          # default
AUTH_MODE=auth0              # production
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://api.gdtracker.example
```

When `AUTH_MODE=auth0`, session login/register/logout/CSRF routes are **not** mounted and CSRF middleware is disabled. Dashboard routes require a valid Auth0 access token for the configured API audience.

---

## Auth0 tenant setup (production)

### 1. Create tenant

1. Sign up at [auth0.com](https://auth0.com) and create a production tenant (e.g. `gdtracker-prod.us.auth0.com`).
2. Do **not** enable social connections (Google, GitHub, etc.).

### 2. Database Connection (username / password only)

1. **Authentication → Database → Username-Password-Authentication**
2. Enable **Requires Username** (disable email-as-username if you want username-only).
3. Disable **Disable Sign Ups** if you want invite-only (recommended for minimal abuse).
4. Under **Settings**, do not require email or phone verification.
5. Password policy: use Auth0 defaults (bcrypt hashing is handled by Auth0).

### 3. API (resource server)

1. **Applications → APIs → Create API**
2. Name: `GDTracker API`
3. Identifier (audience): e.g. `https://api.gdtracker.example` — must match `AUTH0_AUDIENCE` on the Go API.
4. Signing algorithm: RS256.

### 4. SPA application (gdtracker-web)

1. **Applications → Create Application → Single Page Application**
2. Name: `GDTracker Web`
3. Settings:
   - **Allowed Callback URLs**: `https://gdtracker.krondevrasp.com`, `http://localhost:5173` (dev Auth0 testing)
   - **Allowed Logout URLs**: same origins
   - **Allowed Web Origins**: same origins
4. Copy **Domain** and **Client ID** into frontend env (`VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`).
5. Under **APIs**, authorize this SPA for the GDTracker API.

### 5. Custom claim for migrated users (optional)

To preserve existing `users.id` UUIDs after migration, add an Auth0 **Action** (Login / Post Login):

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const gdtrackerUserId = event.user.app_metadata?.gdtracker_user_id;
  if (gdtrackerUserId) {
    api.accessToken.setCustomClaim(
      'https://gdtracker.io/gdtracker_user_id',
      gdtrackerUserId
    );
  }
};
```

Set `app_metadata.gdtracker_user_id` on each imported user to their Postgres `users.id` UUID.

### 6. Signup policy

- **Invite-only (recommended):** disable public sign-up; create users via Auth0 Dashboard or Management API.
- **Self-register:** leave sign-up enabled on the Database Connection (still username/password only).

### 7. Environment checklist

| Variable | Where | Example |
|----------|-------|---------|
| `AUTH_MODE` | Go API | `auth0` |
| `AUTH0_DOMAIN` | Go API | `gdtracker-prod.us.auth0.com` |
| `AUTH0_AUDIENCE` | Go API | `https://api.gdtracker.example` |
| `VITE_AUTH_MODE` | Frontend build | `auth0` |
| `VITE_AUTH0_DOMAIN` | Frontend build | `gdtracker-prod.us.auth0.com` |
| `VITE_AUTH0_CLIENT_ID` | Frontend build | SPA client id |
| `VITE_AUTH0_AUDIENCE` | Frontend build | same as API audience |
| `GDTRACKER_CORS_ALLOWED_ORIGINS` | Go API | `https://gdtracker.krondevrasp.com` |

---

## User migration to Auth0

Use the migration helper:

```bash
cd gdtracker-go-api
# Export users with bcrypt password hashes for Auth0 bulk import
go run ./cmd/migrate-auth0-users -export-import-json auth0-users.json

# After Auth0 import, backfill auth0_sub (CSV: id,auth0_sub)
go run ./cmd/migrate-auth0-users -backfill-csv auth0-subs.csv
```

1. Import `auth0-users.json` via Auth0 Dashboard → User Management → Import Users (Database Connection).
2. For each user, set `app_metadata.gdtracker_user_id` to the Postgres UUID (or use the Post Login Action above).
3. Export Auth0 `user_id` values and backfill `users.auth0_sub` via CSV.

Existing `games.user_id` FKs remain unchanged because internal UUIDs are preserved.

---

## Session flow (AUTH_MODE=session)

1. `POST /api/auth/login` or `POST /api/auth/register` succeeds → encrypted cookie **`JSESSIONID`** (`MaxAge=1800`, 30 minutes, no sliding renewal).
2. Subsequent browser requests send `Cookie: JSESSIONID=...`.
3. Mutating requests require CSRF header `X-XSRF-TOKEN` matching cookie `XSRF-TOKEN`.

## Auth0 flow (AUTH_MODE=auth0)

1. SPA redirects to Auth0 Universal Login (username/password).
2. Auth0 returns tokens; SPA calls API with `Authorization: Bearer <access_token>`.
3. Go API validates JWT (issuer, audience, signature via JWKS) and resolves `users.id` from `auth0_sub` or custom claim.
4. First login auto-provisions a `users` row if none exists.

---

## Spring sources (read-only reference)

| Concern | Primary files |
|--------|-----------------|
| Login / register / logout / me | [`gdtracker-api/.../AuthController.java`](../../gdtracker-api/src/main/java/com/example/api/controller/AuthController.java) |
| Security filter chain, CSRF exemptions, session persistence | [`SecurityConfig.java`](../../gdtracker-api/src/main/java/com/example/api/security/SecurityConfig.java) |

## Go implementation

| Topic | Choice |
|-------|--------|
| Sessions (dev) | `github.com/gorilla/sessions` `CookieStore`, **`JSESSIONID`**, keys from `GDTRACKER_SESSION_SECRET`. |
| Auth0 (prod) | `internal/auth/jwtauth` — JWKS validation, `users.auth0_sub` mapping. |
| User passwords (session mode) | Plaintext store/compare (dev parity only). |
| Ingest tokens | `golang.org/x/crypto/bcrypt` (unchanged). |
| CSRF | Session mode only; manual cookie + header check. |

## Environment

See [`README.md`](README.md) and [`.env.example`](../.env.example).

## Security note

Plaintext passwords in session mode match Spring’s dev encoder only — **not used in production** when `AUTH_MODE=auth0`. Auth0 owns credential storage in production.
