# Auth0 local development (Vite + Go API)

Use this checklist when testing `VITE_AUTH_MODE=auth0` on `http://localhost:5173` (`npm run dev`).

## 1. SPA application (Auth0 Dashboard)

**Applications → Applications →** your SPA (Single Page Application).

| Setting | Value |
|---------|--------|
| **Allowed Callback URLs** | `http://localhost:5173` |
| **Allowed Logout URLs** | `http://localhost:5173/login` |
| **Allowed Web Origins** | `http://localhost:5173` |

Optional extras (comma-separated on the same fields):

- `http://127.0.0.1:5173`, `http://127.0.0.1:5173/login`
- Docker preview: `http://localhost:4173`, `http://localhost:4173/login`

Save changes. A **Callback URL mismatch** means the exact `redirect_uri` in the browser is missing from **Allowed Callback URLs** (scheme, host, port must match).

The SPA sends `redirect_uri` as `window.location.origin` (no path). See `gdtracker-web/src/context/AuthRootProvider.tsx`.

## 2. GDTracker API (resource server)

**Applications → APIs → Create API**

| Field | Value |
|-------|--------|
| Name | `GDTracker API` |
| Identifier (audience) | `https://api.gdtracker.local` (must match `AUTH0_AUDIENCE` / `VITE_AUTH0_AUDIENCE`) |
| Signing Algorithm | RS256 |

Then **Applications → Applications →** your SPA → **APIs** → authorize the SPA for **GDTracker API**.

Do **not** use the Management API audience (`…/api/v2/`) for login — the Go API rejects those tokens.

## 3. Environment (repo root `.env`)

```bash
AUTH_MODE=auth0
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://api.gdtracker.local

VITE_AUTH_MODE=auth0
VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=your-spa-client-id
VITE_AUTH0_AUDIENCE=https://api.gdtracker.local

GDTRACKER_CORS_ALLOWED_ORIGINS=http://localhost:5173
```

Restart **both** the Go API and `npm run dev` after changing env (Vite bakes `VITE_*` at startup).

`gdtracker-web` loads env from the **repository root** (see `vite.config.ts` `envDir`).

## 4. Verify

1. Sign in → return to `http://localhost:5173` without Auth0 errors.
2. Network tab: API requests include `Authorization: Bearer …`.
3. `GET /api/auth/me` → **200**.

If (1) works but (3) is **401**, check `AUTH0_AUDIENCE` matches the API identifier and `AUTH_MODE=auth0` on the API.

See also [`AUTH.md`](AUTH.md).

---

## Production (Docker — gdtracker.krondevrasp.com)

| Auth0 SPA setting | Value |
|-------------------|--------|
| Allowed Callback URLs | `https://gdtracker.krondevrasp.com` |
| Allowed Logout URLs | `https://gdtracker.krondevrasp.com/login` |
| Allowed Web Origins | `https://gdtracker.krondevrasp.com` |

Deploy steps, Jenkins `VITE_*` checklist, and PWA cache: [`../../docs/DEPLOY_AUTH0.md`](../../docs/DEPLOY_AUTH0.md).
