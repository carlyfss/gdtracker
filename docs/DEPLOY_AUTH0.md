# Auth0 production deploy (Docker Compose / Jenkins)

## Build-time vs runtime env

| Stage | Variables | Where |
|-------|-----------|--------|
| **`docker compose build frontend`** | `VITE_AUTH_MODE`, `VITE_AUTH0_*`, `VITE_API_BASE_URL` | Jenkins job environment (secrets) → Compose `build.args` |
| **`docker compose up` backend** | `AUTH_MODE`, `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `GDTRACKER_CORS_ALLOWED_ORIGINS` | Container `environment` |

Setting only **`AUTH_MODE=auth0`** does not bake Auth0 into the SPA. All **`VITE_*`** names must be in the shell that runs `docker compose build frontend`.

## Jenkins deploy command

```bash
# Fail fast if frontend Auth0 vars are missing from the job environment
test -n "$VITE_AUTH_MODE" && test -n "$VITE_AUTH0_DOMAIN" && test -n "$VITE_AUTH0_CLIENT_ID" \
  && test -n "$VITE_AUTH0_AUDIENCE" && test -n "$VITE_API_BASE_URL"

echo "AUTH_MODE=$AUTH_MODE VITE_AUTH_MODE=$VITE_AUTH_MODE VITE_API_BASE_URL=$VITE_API_BASE_URL"

docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml build backend
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate backend frontend

# Verify a precached asset exists in the running container (use a file from build output or browser error)
docker compose exec frontend ls -la /usr/share/nginx/html/assets/ | head
```

## Required production values

```bash
AUTH_MODE=auth0
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=<GDTracker API identifier>
GDTRACKER_CORS_ALLOWED_ORIGINS=https://app.example.com
GDTRACKER_COOKIE_SECURE=true

VITE_AUTH_MODE=auth0
VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=your-spa-client-id
VITE_AUTH0_AUDIENCE=<same as AUTH0_AUDIENCE>
VITE_API_BASE_URL=https://api.example.com
```

Replace example hosts with values from `.env.deploy`.

Auth0 Dashboard URLs: [`gdtracker-go-api/docs/AUTH0_LOCAL_DEV.md`](../gdtracker-go-api/docs/AUTH0_LOCAL_DEV.md) (production section).

## Auth0 Dashboard — authorize SPA for API (fixes `oauth/token` `access_denied`)

If Auth0 redirects to `https://app.example.com/?code=…` but **`POST …/oauth/token` returns 401** with **`access_denied`**, the SPA is usually **not authorized** for the GDTracker API audience.

1. **Applications → APIs →** your GDTracker API (identifier = `AUTH0_AUDIENCE`, e.g. `https://api.example.com`).
2. **Applications → Applications →** your SPA → **APIs** tab → enable **GDTracker API** (Authorized).
3. Confirm SPA **Application Type** = Single Page Application; **Token Endpoint Authentication Method** = None.
4. **Grant Types:** Authorization Code (and Refresh Token if used).
5. **Actions → Flows:** ensure no Login/Post-Login Action returns `access_denied`.

`VITE_AUTH0_AUDIENCE` and `AUTH0_AUDIENCE` must match the API **Identifier** exactly (not the Management API `…/api/v2/`).

## PWA / service worker after deploy

`VITE_*` are baked at build time. **`docker compose up` alone does not update the login UI.**

After each frontend deploy:

1. **Unregister** service workers for `app.example.com` (DevTools → Application → Service Workers).
2. **Clear site data** or hard reload once.
3. Confirm `/login` shows Auth0 text, not “Local testing only”.

### `bad-precaching-response` (404 on `assets/*.js`)

Workbox precache failed because a hashed file in the manifest returned **404** (incomplete image or stale SW). The app now uses `skipWaiting` + `clientsClaim` and reloads on update ([`gdtracker-web/src/main.tsx`](../gdtracker-web/src/main.tsx)).

If the error persists:

```bash
curl -sfI "https://app.example.com/assets/<filename-from-error>.js"
docker compose exec frontend test -f "/usr/share/nginx/html/assets/<filename>.js" && echo OK || echo MISSING
```

If **MISSING** in the container, rebuild the frontend image; if **OK** on server but 404 in browser, clear the service worker.

## Verify Auth0 login

1. After sign-in, **`POST https://<tenant>.us.auth0.com/oauth/token` → 200** (not 401 `access_denied`).
2. No `GET /api/csrf` in Network (API is auth0 mode).
3. `GET https://api.example.com/api/auth/me` with `Authorization: Bearer …` → **200**.
4. No `bad-precaching-response` in the console.

### Asset hash coherence (after frontend deploy)

`index.html`, `sw.js`, and files under `/assets/` must reference the **same** build:

```bash
docker compose exec frontend sh -c \
  'grep -o "index-[^\"]*\.js" /usr/share/nginx/html/index.html; ls /usr/share/nginx/html/assets/index-*.js'
```

The hash in `index.html` must exist in `assets/`. If not, rebuild with `--no-cache frontend` and `--force-recreate frontend`.

## Rollback

Set `AUTH_MODE=session`, `VITE_AUTH_MODE=session`, rebuild frontend, recreate backend.
