# `gdtracker-go-api` docs

## What lives here

- **OpenAPI**: `docs/openapi.yaml` (update whenever routes/req/resp/status codes change)
- **Liquibase parity / migration authority**: `docs/MIGRATIONS.md`
- **Auth / CSRF / CORS (Spring parity)**: `docs/AUTH.md`

## Directory map (code)

```
gdtracker-go-api/
├── cmd/gdtracker-go-api/   # entrypoint
├── internal/
│   ├── db/                 # Postgres DSN (JDBC→postgres URL), pool, embedded golang-migrate SQL
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
- **Migrations**: 23 versions embedded under `internal/db/migrations/` (mirrors Liquibase order). See **`MIGRATIONS.md`** for the inventory and **single-owner** rules (Liquibase vs golang-migrate).
- **Auto migrate**: `GDTRACKER_GO_AUTO_MIGRATE` — `auto` (default), `on`, or `off`. Default `auto` skips golang-migrate when table `databasechangelog` exists so a Spring-managed database is not double-migrated.

## HTTP

- **`GET /healthz`** — process up (no DB required).
- **`GET /readyz`** — `200` if Postgres is configured and ping succeeds; `503` if DB disabled or ping fails.

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

Compare resulting tables to a Spring `ddl-auto=validate` database, or run Spring against the same DB only **after** choosing a single migration owner (see `MIGRATIONS.md`).

### CLI-only migrate (optional)

Install [`migrate`](https://github.com/golang-migrate/migrate/tree/master/cmd/migrate), export a **postgres://** DSN (see `internal/db/dsn.go` for JDBC conversion rules), and run `migrate -path internal/db/migrations -database "$DATABASE_URL" up` from `gdtracker-go-api/` if you prefer migrations outside the binary.
