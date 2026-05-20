# GDTracker

The workspace combines a **Vite/React dashboard** with a **Go REST API** ([`gdtracker-go-api/`](./gdtracker-go-api/)) as the **supported** backend for Docker Compose and new development. The **Spring Boot** project ([`gdtracker-api/`](./gdtracker-api/)) remains in the repo **only for legacy use** and is **deprecated**—do not extend it for new features.

| Project | Path | Stack |
|---|---|---|
| Frontend dashboard | [gdtracker-web/](./gdtracker-web/) | Vite + React 19 + TypeScript |
| REST API (supported) | [gdtracker-go-api/](./gdtracker-go-api/) | Go + net/http, PostgreSQL, golang-migrate |
| Spring API (deprecated) | [gdtracker-api/](./gdtracker-api/) | Spring Boot 3.2 + Java 21 — **unsupported**; see [gdtracker-api/README.md](./gdtracker-api/README.md) |

Each app folder is self-contained — its own `README.md` or `docs/`, `Dockerfile` where present, `.env.example`, and `.gitignore` — so you can either keep this directory as a single monorepo or split each subfolder into its own GitHub repo.

## Quick start (one command)

```bash
cp .env.example .env       # edit values; see minimums below
docker compose up -d --build
```

**Minimum `.env` values for Compose:** `POSTGRES_PASSWORD`, `DB_PASSWORD` (match Postgres), and **`GDTRACKER_SESSION_SECRET`** (required by the Go API in Docker; use a long random string, at least 32 characters).

This starts:

- `postgres` — PostgreSQL 14, persistent volume `gdtracker-pgdata`, **host port `5433`** mapped to `5432` inside the container (see `docker-compose.yml`).
- `backend` — **`gdtracker-go-api`** (Go), exposed on `${SERVER_PORT}` (default `8080`). Schema updates use **embedded golang-migrate** on startup unless `GDTRACKER_GO_AUTO_MIGRATE=off`; see [gdtracker-go-api/docs/MIGRATIONS.md](./gdtracker-go-api/docs/MIGRATIONS.md).
- `frontend` — **`gdtracker-web`** (nginx serving the static bundle), exposed on `${FRONTEND_PORT}` (default `5173`). Open `http://localhost:5173`.

If you previously used compose with the old volume name `numb-tracker-pgdata`, either keep using that data by renaming the Docker volume to `gdtracker-pgdata` or run `docker compose down -v` and start fresh (drops DB data).

Useful follow-ups:

```bash
docker compose logs -f backend          # watch Go API startup / migrations
docker compose ps                       # service status
docker compose down                     # stop (keep volume)
docker compose down -v                  # stop and DROP the database volume
docker compose build --no-cache frontend  # rebuild after changing VITE_API_BASE_URL
```

## Workspace env vars

`.env` at the workspace root is consumed by `docker-compose.yml`. See [.env.example](./.env.example) for the canonical list with comments. Highlights:

| Variable | Required | Used by | Notes |
|---|---|---|---|
| `POSTGRES_USER` / `POSTGRES_DB` | recommended | postgres | Initial role and database created on first start |
| `POSTGRES_PASSWORD` | **yes** | postgres | Compose refuses to start without it |
| `DB_URL` | recommended | backend | Default JDBC-style URL points at the compose `postgres` service (`jdbc:postgresql://postgres:5432/...`). |
| `DB_USERNAME` | recommended | backend | Must match the DB role (default aligns with `POSTGRES_USER`) |
| `DB_PASSWORD` | **yes** | backend | Should match `POSTGRES_PASSWORD` |
| `SERVER_PORT` | no | backend | Host and container listen port for the Go API (default `8080`; sets `PORT` in the `backend` service) |
| `GDTRACKER_SESSION_SECRET` | **yes** (Compose) | backend | Session signing for the Go API; required in `docker-compose.yml` for `backend` |
| `GDTRACKER_CORS_ALLOWED_ORIGINS` | no | backend | Comma-separated origins for credentialed `/api/**` requests. **`localhost` and `127.0.0.1` are different** — list both if you switch hosts. Compose defaults to `http://localhost:${FRONTEND_PORT}` when unset. Changing only this: recreate `backend` (no frontend rebuild). |
| `GDTRACKER_COOKIE_DOMAIN` | no | backend | Cookie `Domain` for cross-subdomain setups; often empty on localhost |
| `GDTRACKER_COOKIE_SECURE` | no | backend | Set `true` when the API is only served over HTTPS |
| `GDTRACKER_GO_AUTO_MIGRATE` | no | backend | `auto` (default) / `on` run embedded migrations Up; `off` skips (see [MIGRATIONS.md](./gdtracker-go-api/docs/MIGRATIONS.md)) |
| `GDTRACKER_GO_MIGRATE_FORCE_VERSION` | no | backend | One-shot dirty repair; see [MIGRATIONS.md](./gdtracker-go-api/docs/MIGRATIONS.md) |
| `GDTRACKER_ARCHIVE_RETENTION` | no | backend | Archive retention feature flag; details in [ARCHIVE_RETENTION.md](./gdtracker-go-api/docs/ARCHIVE_RETENTION.md) |
| `GDTRACKER_ARCHIVE_RETENTION_TIMEZONE` | no | backend | With archive retention |
| `GDTRACKER_ARCHIVE_RETENTION_HOUR` | no | backend | With archive retention |
| `GDTRACKER_ARCHIVE_RETENTION_MINUTE` | no | backend | With archive retention |
| `VITE_API_BASE_URL` | yes for prod image build | frontend | Baked into the bundle at image build time — typically `http://localhost:${SERVER_PORT}` from the browser |
| `FRONTEND_PORT` | no | frontend | Host port published for the SPA (default `5173`) |

**Ports:** With default Compose, Postgres on the **host** is **`localhost:5433`** (container internal port remains `5432`). Inside the Docker network, services use hostname `postgres` and port `5432`.

## Standalone Postgres (without compose)

Equivalent to the old `annotations.md` snippet, but with credentials read from the env:

```bash
docker run -d --name gdtracker-pg \
    -e POSTGRES_USER="$POSTGRES_USER" \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    -e POSTGRES_DB="$POSTGRES_DB" \
    -p 5432:5432 \
    -v gdtracker-pgdata:/var/lib/postgresql/data \
    postgres:14-alpine
```

Use a host port that does not conflict with other Postgres instances. If you match this repo’s Compose mapping elsewhere, prefer documenting `5433` on the host for consistency.

## Troubleshooting

### Docker Compose + Go API (`backend`)

- **Compose fails: `GDTRACKER_SESSION_SECRET` required** — set a strong secret in `.env` (see `.env.example`).
- **Backend exits with `DB_PASSWORD` errors** — ensure `.env` is populated and `docker compose up` was run from this directory.
- **Backend can't reach Postgres in compose** — `DB_URL` should use the service name: `jdbc:postgresql://postgres:5432/...`. `localhost` only works when the API runs on the host.
- **Backend on host, Postgres in compose** — map the host port from `docker-compose.yml` (default **`5433`**): e.g. `DB_URL=jdbc:postgresql://127.0.0.1:5433/...` for `gdtracker-go-api` on the host.
- **Backend in compose, Postgres on a remote host** — set `DB_URL=jdbc:postgresql://<your-db-host>:5432/...` in `.env`. On Linux, add `extra_hosts: ["<your-db-host>:<IP>"]` under the `backend` service if DNS doesn't resolve inside the container.
- **Frontend hits the wrong API after changing `VITE_API_BASE_URL`** — the value is baked at build time. Rebuild: `docker compose build --no-cache frontend && docker compose up -d frontend`.
- **Auth0: still username/password login or `/api/csrf` 404** — frontend image needs `VITE_AUTH_MODE=auth0` at **build** time (Jenkins must export all `VITE_AUTH0_*`, not only `AUTH_MODE`). See [docs/DEPLOY_AUTH0.md](./docs/DEPLOY_AUTH0.md).
- **Auth0: `bad-precaching-response` (404 on `assets/*.js`)** — incomplete deploy or stale service worker. Rebuild frontend, verify asset exists in container, then unregister SW and clear site data for `gdtracker.krondevrasp.com`. See [docs/DEPLOY_AUTH0.md](./docs/DEPLOY_AUTH0.md).
- **“Login failed.” when using Docker Compose** — the dashboard shows this for credential errors **and** network failures. In DevTools **Network**, check `/api/auth/login` (and any `OPTIONS` preflight): a **blocked CORS** error means the SPA `Origin` is not allowed (`localhost` and `127.0.0.1` are distinct — align `GDTRACKER_CORS_ALLOWED_ORIGINS`, `FRONTEND_PORT`, `VITE_API_BASE_URL`, and the host you type in the browser). If requests reach the API but return **`401`**, register first or use any documented bootstrap user for your stack. Wrong base URL (`ECONNREFUSED`, `404`) → **`VITE_API_BASE_URL`** must match `${SERVER_PORT}` on the machine you browse from (`http://localhost:…` vs `http://127.0.0.1:…`); rebuild the frontend image after changing `VITE_API_BASE_URL`.
- **Migration errors on startup** — see [gdtracker-go-api/docs/MIGRATIONS.md](./gdtracker-go-api/docs/MIGRATIONS.md) (`GDTRACKER_GO_AUTO_MIGRATE`, dirty repair).
- **Port already in use** — change `SERVER_PORT` or `FRONTEND_PORT` in `.env`, then `docker compose up -d`.
- **CSRF 403 on first POST** — the SPA uses double-submit CSRF. Issue any authenticated GET first (e.g. `GET /api/games`) so the `XSRF-TOKEN` cookie is set, then retry the POST.

### Legacy Spring API (`gdtracker-api` on the host)

Use only if you still run the Spring app outside Compose. It uses **Liquibase**, `application.properties`, and Spring-specific validation settings.

- **Liquibase fails with "validate"** — `spring.jpa.hibernate.ddl-auto=validate` requires the schema to already exist. On a fresh DB, Liquibase creates everything before validation. If you point Spring at a pre-existing DB with mismatched tables, fix the schema or temporarily switch `ddl-auto` to `update`.
- Defaults for CORS and cookies when running Spring come from `gdtracker-api` config, not the Go env vars above.

## Security & publishing notes (read before pushing to GitHub)

- The DB password that previously lived in `gdtracker-api/src/main/resources/application.properties` (and `annotations.md`) is **considered compromised**. Rotate it on the actual database and update wherever it was used.
- `annotations.md` is git-ignored at every level (workspace, frontend, backend) — keep it that way; it contains personal notes/credentials.
- **Legacy Spring (`gdtracker-api`)** shipped with a **plaintext password encoder** for application users and a `legacy / legacy` bootstrap row in `0006_users_games_multitenancy.sql`. Both are dev-only patterns; **do not deploy publicly** without hardening and removing the bootstrap row. Treat any production Go deployment with the same seriousness: strong secrets, HTTPS, and reviewed auth.
- Before the first `git push`, run `git status` and confirm none of these are staged: `.env`, `.env.local`, `target/`, `node_modules/`, `dist/`, `annotations.md`, `*.iml`.

## License

SPDX-License-Identifier: [GPL-3.0-only](https://spdx.org/licenses/GPL-3.0-only.html)

Copyright (C) 2026 GDTracker contributors.

The combined workspace (frontend, API, and orchestration files at this root) is licensed under the **GNU General Public License v3.0**. See the full text in [`LICENSE`](./LICENSE). Short summary: you may use, modify, and distribute this software; if you distribute modified versions, you must license them under GPL-3.0 and make corresponding source available under the same terms.

Contributions: see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Releases and versioning

Per-app semantic versioning, branch naming, tags, and release checklist: [`.cursor/skills/release-manager/VERSIONING.md`](./.cursor/skills/release-manager/VERSIONING.md).

## Project guidance docs

Each app keeps its own developer guidance under `docs/`:

- [gdtracker-go-api/docs/README.md](./gdtracker-go-api/docs/README.md) — **supported** Go API: layout, commands, OpenAPI.
- [gdtracker-web/docs/README.md](./gdtracker-web/docs/README.md) — frontend layout, routing, env vars.
- [gdtracker-api/docs/README.md](./gdtracker-api/docs/README.md) — **deprecated** Spring API (legacy only).

When changing behavior, update the relevant `docs/` in the same change so the feature/directory maps stay accurate.
