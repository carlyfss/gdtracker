# `gdtracker-go-api` docs

## What lives here

- **OpenAPI**: `docs/openapi.yaml` (update whenever routes/req/resp/status codes change)
- **Embedded SQL migrations (golang-migrate)**: `docs/MIGRATIONS.md`
- **Auth / CSRF / CORS (Spring parity)**: `docs/AUTH.md`
- **Archive retention (scheduled purge of archived rows)**: `docs/ARCHIVE_RETENTION.md`
- **Spring vs Go error-shape notes (ingest/session)**: `docs/CODE_REVIEW_SPOTCHECK.md`

## Directory map (code)

```
gdtracker-go-api/
├── cmd/gdtracker-go-api/   # entrypoint
├── internal/
│   ├── db/                 # Postgres DSN (JDBC→postgres URL), pool, embedded golang-migrate SQL
│   ├── retention/          # archive TTL purge (Spring ArchiveRetentionService parity)
│   └── httpx/              # small HTTP helpers
├── controller/             # HTTP handlers (when added)
├── service/
├── repository/
├── model/
├── util/
└── docs/
```

## Auth (Phase 1)

- **Routes**: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/csrf`.
- **Env**: `GDTRACKER_SESSION_SECRET` (**required** when `DB_URL` is set), `GDTRACKER_CORS_ALLOWED_ORIGINS`, optional `GDTRACKER_COOKIE_DOMAIN`, `GDTRACKER_COOKIE_SECURE`.
- **Details**: [`AUTH.md`](AUTH.md).

## Database (Phase 0)

- **Env**: `DB_URL` (JDBC `jdbc:postgresql://host:port/dbname[?query]`), `DB_USERNAME`, `DB_PASSWORD` — same as [`gdtracker-api`](../../gdtracker-api/README.md).
- **Migrations**: Embedded SQL under `internal/db/migrations/` (`*_up.sql` / `*_down.sql`). See **`MIGRATIONS.md`** for inventory and operational notes.
- **Auto migrate**: `GDTRACKER_GO_AUTO_MIGRATE` — `auto` (default) or `on` runs embedded golang-migrate **Up** on startup; `off` skips (operational escape hatch).

## Archive retention

When the database is enabled, a background goroutine purges old **archived** tasks and features using `ARCHIVE_TIME_BOMB` in `game_configurations.settings` (default **30** days). Configure schedule and timezone with `GDTRACKER_ARCHIVE_RETENTION*` env vars. Details: **`ARCHIVE_RETENTION.md`**.

## HTTP

- **`GET /healthz`** — process up (no DB required).
- **`GET /readyz`** — `200` if Postgres is configured and ping succeeds; `503` if DB disabled or ping fails.
- **Domain routes (games, categories, tags, tasks, features, configuration, archives, game-exceptions, ingest plane, game events, traces, feedback)** — see `openapi.yaml` (source of truth for paths and schemas).

## Common commands

```bash
cd gdtracker-go-api
cp .env.example .env   # first time; set DB_PASSWORD

set -a && source .env && set +a   # or export manually
gofmt -w .
go test ./...
go run ./cmd/gdtracker-go-api
```

### Validate migrations against a real Postgres

Use a disposable database (Docker or local). Example:

```bash
# Example: Postgres listening on localhost, empty database testdb, GDTRACKER_GO_AUTO_MIGRATE=on
export DB_URL=jdbc:postgresql://localhost:5432/testdb
export DB_USERNAME=...
export DB_PASSWORD=...
export GDTRACKER_GO_AUTO_MIGRATE=on
go run ./cmd/gdtracker-go-api
# In another terminal:
curl -sf http://localhost:8080/readyz
```

See **`MIGRATIONS.md`** if you share a database with legacy tooling (Liquibase history may still exist alongside **`schema_migrations`**).

### CLI-only migrate (optional)

Install [`migrate`](https://github.com/golang-migrate/migrate/tree/master/cmd/migrate), export a **postgres://** DSN (see `internal/db/dsn.go` for JDBC conversion rules), and run `migrate -path internal/db/migrations -database "$DATABASE_URL" up` from `gdtracker-go-api/` if you prefer migrations outside the binary.
