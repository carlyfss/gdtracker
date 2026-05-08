# GDTracker

The workspace combines a **Vite/React dashboard** with a **Spring Boot REST API** (primary backend) and an optional **Go HTTP service** (`gdtracker-go-api`).

| Project | Path | Stack |
|---|---|---|
| Frontend dashboard | [gdtracker-web/](./gdtracker-web/) | Vite + React 19 + TypeScript |
| REST API | [gdtracker-api/](./gdtracker-api/) | Spring Boot 3.2 + Java 21 + PostgreSQL + Liquibase |
| Go API (experimental) | [gdtracker-go-api/](./gdtracker-go-api/) | Go 1.22 + net/http |

Each app folder is self-contained — its own `README.md` or `docs/`, `Dockerfile` where present, `.env.example`, and `.gitignore` — so you can either keep this directory as a single monorepo or split each subfolder into its own GitHub repo.

## Quick start (one command)

```bash
cp .env.example .env       # edit values; at minimum set POSTGRES_PASSWORD/DB_PASSWORD
docker compose up -d --build
```

This starts:

- `postgres` — PostgreSQL 16, persistent volume `gdtracker-pgdata`, exposed on `5432`.
- `backend` — `gdtracker-api`, exposed on `${SERVER_PORT}` (default `8080`). Liquibase runs migrations on first start.
- `frontend` — **`gdtracker-web`** (nginx serving the static bundle), exposed on `${FRONTEND_PORT}` (default `5173`). Open `http://localhost:5173`.

If you previously used compose with the old volume name `numb-tracker-pgdata`, either keep using that data by renaming the Docker volume to `gdtracker-pgdata` or run `docker compose down -v` and start fresh (drops DB data).

Useful follow-ups:

```bash
docker compose logs -f backend          # watch backend startup / migrations
docker compose ps                       # service status
docker compose down                     # stop (keep volume)
docker compose down -v                  # stop and DROP the database volume
docker compose build --no-cache frontend  # rebuild after changing VITE_API_BASE_URL
```

## Workspace env vars

`.env` at the workspace root is consumed by `docker-compose.yml`. See [.env.example](./.env.example) for the canonical list. Highlights:

| Variable | Required | Used by | Notes |
|---|---|---|---|
| `POSTGRES_USER` / `POSTGRES_DB` | recommended | postgres | Initial role and database created on first start |
| `POSTGRES_PASSWORD` | **yes** | postgres | Compose refuses to start without it |
| `DB_URL` / `DB_USERNAME` | recommended | backend | Default URL points at the compose `postgres` service |
| `DB_PASSWORD` | **yes** | backend | Should match `POSTGRES_PASSWORD` |
| `SERVER_PORT` | no | backend | Default `8080` |
| `VITE_API_BASE_URL` | yes for prod build | frontend | Baked into the bundle at image build time |
| `FRONTEND_PORT` | no | frontend | Host port to publish the SPA on (default `5173`) |
| `GDTRACKER_CORS_ALLOWED_ORIGINS` | no | backend | Comma-separated origin patterns for credentialed `/api/**` requests. **`localhost` and `127.0.0.1` are different** — browse with one host consistently, list both origins if you mix them, or set `GDTRACKER_CORS_ALLOWED_ORIGINS` accordingly. Compose sets `http://localhost:${FRONTEND_PORT}` when unset. Changing only this value: recreate backend (no frontend rebuild). Defaults also come from `application.properties`. |

## Standalone Postgres (without compose)

Equivalent to the old `annotations.md` snippet, but with credentials read from the env:

```bash
docker run -d --name gdtracker-pg \
    -e POSTGRES_USER="$POSTGRES_USER" \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    -e POSTGRES_DB="$POSTGRES_DB" \
    -p 5432:5432 \
    -v gdtracker-pgdata:/var/lib/postgresql/data \
    postgres:16-alpine
```

## Troubleshooting

- **Backend exits with `DB_PASSWORD` errors** — `application.properties` has no default for the password. Make sure `.env` is populated and that `docker compose up` was run from this directory.
- **Backend can't reach Postgres in compose** — `DB_URL` should use the service name: `jdbc:postgresql://postgres:5432/...`. `localhost` only works when the backend runs on the host.
- **Backend on host, Postgres in compose** — `DB_URL=jdbc:postgresql://localhost:5432/...` (compose maps `5432` to host).
- **Backend in compose, Postgres on a remote host** — set `DB_URL=jdbc:postgresql://<your-db-host>:5432/...` in `.env`. On Linux, add `extra_hosts: ["<your-db-host>:<IP>"]` under the `backend` service if DNS doesn't resolve inside the container.
- **Frontend hits the wrong API after changing `VITE_API_BASE_URL`** — the value is baked at build time. Rebuild: `docker compose build --no-cache frontend && docker compose up -d frontend`.
- **“Login failed.” when using Docker Compose** — the dashboard shows this message for credential errors **and** for network failures. In DevTools **Network**, check `/api/auth/login` (and any `OPTIONS` preflight): a **blocked CORS** error means the SPA `Origin` is not allowed (`localhost` and `127.0.0.1` are treated as distinct — align `GDTRACKER_CORS_ALLOWED_ORIGINS`, `FRONTEND_PORT`, `VITE_API_BASE_URL`, and the host you actually type into the browser). Compose passes `http://localhost:${FRONTEND_PORT}` by default when the env is unset. If requests reach the API but return **`401`**, register first or sign in as bootstrap **`legacy` / `legacy`**. Wrong base URL (`ECONNREFUSED`, `404`) → **`VITE_API_BASE_URL`** must match `${SERVER_PORT}` on the machine you browse from (`http://localhost:…` vs `http://127.0.0.1:…`); rebuild the frontend image after changing `VITE_API_BASE_URL`.
- **Liquibase fails with "validate"** — `spring.jpa.hibernate.ddl-auto=validate` requires the schema to already exist. On a fresh DB, Liquibase creates everything before validation. If you point the API at a pre-existing DB with mismatched tables, fix the schema or temporarily switch `ddl-auto` to `update`.
- **Port already in use** — change `SERVER_PORT` or `FRONTEND_PORT` in `.env`, then `docker compose up -d`.
- **CSRF 403 on first POST** — the SPA uses double-submit CSRF. Issue any authenticated GET first (e.g. `GET /api/games`) so the `XSRF-TOKEN` cookie is set, then retry the POST.

## Security & publishing notes (read before pushing to GitHub)

- The DB password that previously lived in `gdtracker-api/src/main/resources/application.properties` (and `annotations.md`) is **considered compromised**. Rotate it on the actual database and update wherever it was used.
- `annotations.md` is git-ignored at every level (workspace, frontend, backend) — keep it that way; it contains personal notes/credentials.
- The backend ships with a **plaintext password encoder** for application users and a `legacy / legacy` bootstrap row in `0006_users_games_multitenancy.sql`. Both are intentional dev-only patterns; **do not deploy publicly without replacing them with bcrypt and removing the bootstrap row**.
- Before the first `git push`, run `git status` and confirm none of these are staged: `.env`, `.env.local`, `target/`, `node_modules/`, `dist/`, `annotations.md`, `*.iml`.

## License

SPDX-License-Identifier: [GPL-3.0-only](https://spdx.org/licenses/GPL-3.0-only.html)

Copyright (C) 2026 GDTracker contributors.

The combined workspace (frontend, API, and orchestration files at this root) is licensed under the **GNU General Public License v3.0**. See the full text in [`LICENSE`](./LICENSE). Short summary: you may use, modify, and distribute this software; if you distribute modified versions, you must license them under GPL-3.0 and make corresponding source available under the same terms.

Contributions: see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Project guidance docs

Each app keeps its own developer guidance under `docs/`:

- [gdtracker-api/docs/README.md](./gdtracker-api/docs/README.md) — backend overview, REST surface, env vars.
- [gdtracker-web/docs/README.md](./gdtracker-web/docs/README.md) — frontend layout, routing, env vars.
- [gdtracker-go-api/docs/README.md](./gdtracker-go-api/docs/README.md) — Go service layout, commands, OpenAPI.

When changing behavior, update the relevant `docs/` in the same change so the feature/directory maps stay accurate.
