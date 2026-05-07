# GDTracker API — overview

## Purpose

Spring Boot JSON API backing exception reporting, trace location heatmaps, task tracking, and feature metadata. Data is scoped per **game** (tenant); users authenticate with HTTP sessions. Default HTTP port **8080** (`spring.application.name=gdtracker-api`).

## Package layout

All application code lives under `src/main/java/com/example/api/`:

| Package / area | Role |
|----------------|------|
| `SpringApiApplication.java` | Boot entry |
| `controller/` | REST endpoints and `ValidationExceptionHandler` (Bean Validation → 400) |
| `dto/` | Request DTOs (records) with Jakarta validation annotations |
| `repository/` | Spring Data JPA interfaces |
| `model/` | JPA entities and enums (`TaskStatus`, etc.) — Lombok for getters/setters/no-args constructors where applicable |
| `service/` | Cross-cutting helpers (e.g. `GameAccessService` for ownership checks) |
| `util/` | Stateless helpers (formatting, parsing, pure functions)—not domain workflow; use `service/` for shared business rules |
| `security/` | Spring Security (`SecurityConfig`, `AppUserPrincipal`, plaintext dev `PasswordEncoder` for user passwords, separate **BCrypt** `ingestTokenPasswordEncoder` for per-game ingest tokens) |

Controllers use repositories directly for persistence; `GameAccessService` centralizes resolving the current user and verifying game ownership.

## Shared utilities & reuse

**Before** adding logic that duplicates existing behavior, search **`service/`**, **`dto/`**, and **`util/`** under `com.example.api`.

| Kind of reuse | Where |
|----------------|--------|
| Stateless helpers (dates, formatting, pure validation helpers, e.g. `ColorHex` for `#RRGGBB` validation) | `util/` — package `com.example.api.util` (add subpackages if grouping grows) |
| Domain or business rules used by multiple callers | `service/` — `@Service` |
| Repeated request/response shaping | `dto/` (records) and mapping kept next to DTOs or a dedicated mapper pattern |

Avoid stuffing domain rules into a catch-all “utils” class. Agents and contributors: the workspace rule **`code-reuse-dry`** applies to all edits here—extract shared logic when the same non-trivial pattern appears in more than one place, and extend this overview when you introduce a notable new reusable module.

## HTTP contract (OpenAPI)

The canonical route list and request/response examples live in **[`docs/openapi.yaml`](openapi.yaml)** (OpenAPI 3). Update that file in the same change whenever REST paths, methods, or public bodies change; use placeholder values in examples, not live secrets.

## Stack and decisions

| Topic | Choice |
|-------|--------|
| Framework | Spring Boot 3.2, Java 21 ([`pom.xml`](../pom.xml)) |
| Web | `spring-boot-starter-web` |
| Security | `spring-boot-starter-security` — **session** authentication after `POST /api/auth/login` or `POST /api/auth/register`; **CSRF** uses `CookieCsrfTokenRepository` with **`CsrfTokenRequestAttributeHandler`** (plain double-submit: the `XSRF-TOKEN` cookie value is sent verbatim as `X-XSRF-TOKEN`, matching the Vite SPA Axios interceptor). Login/register URLs ignore CSRF. **Bearer ingest endpoints** — `POST /api/games/{gameId}/game-players` (token only), `POST .../integration` (token only; body `{"validation":"ok"}`), plus `POST .../game-events/ingest`, `.../game-trace/ingest`, `.../game-exceptions/ingest`, `.../game-feedback/ingest` (**permitAll**, **CSRF-exempt**); clients send `Authorization: Bearer <ingest token>` and, on routes other than `game-players` and `integration`, header **`X-Player-Id`** (UUID returned from `game-players`). **Priming:** perform at least one **GET** to an authenticated route before the first mutating call so the cookie is issued (deep links may prime on page load). Access denied and unhandled exceptions are logged at WARN/ERROR. |
| Validation | `spring-boot-starter-validation` (request DTOs) |
| Persistence | `spring-boot-starter-data-jpa` |
| Boilerplate | **Lombok** (`lombok.config` at project root) — compile-time only; IDE needs Lombok plugin for navigation |
| Database | **PostgreSQL** (driver at runtime). Connection and credentials are read from **environment variables** (`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, optional `SERVER_PORT`) by `application.properties` placeholders. Local values go in a git-ignored `.env` (see `.env.example`). **Never** put real secrets in `application.properties`, docs, or `annotations.md`. |
| License | **GPL-3.0-only** — workspace [`LICENSE`](../../LICENSE); see [`pom.xml`](../pom.xml) `licenses` metadata. |
| Schema | **Liquibase** — `spring.liquibase.change-log=classpath:db/changelog/db.changelog-master.xml` |
| Hibernate | `spring.jpa.hibernate.ddl-auto=validate` (schema must match entities; changes go through Liquibase) |
| Open session in view | `spring.jpa.open-in-view=false` |
| Java format | **Spotless** + Palantir Java Format (`PALANTIR`, 120-column style) — configured in [`pom.xml`](../pom.xml); run `mvn spotless:apply` |
| Java lint | **Checkstyle** — [`checkstyle.xml`](../checkstyle.xml) (line length 120, indentation 4); run `mvn checkstyle:check` |
| EditorConfig | [`.editorconfig`](../.editorconfig) |

## REST API (summary)

Base path **`/api`**. Domain routes are scoped under **`/api/games/{gameId}/...`** and require an authenticated session whose user **owns** that game (otherwise `404 game not found`).

| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |
| Games | `GET /api/games`, `POST /api/games` |
| Features | `GET/POST /api/games/{gameId}/features`, `PUT/DELETE /api/games/{gameId}/features/{id}` |
| Tasks | `GET /api/games/{gameId}/tasks` (optional `featureId`, `status`, `categoryId`, repeated `tagIds`, `tagMode` ANY or ALL), `POST /api/games/{gameId}/tasks`, `PUT/DELETE /api/games/{gameId}/tasks/{id}` |
| Categories | `GET/POST /api/games/{gameId}/categories`, `PUT/DELETE /api/games/{gameId}/categories/{id}` |
| Tags | `GET/POST /api/games/{gameId}/tags`, `PUT/DELETE /api/games/{gameId}/tags/{id}` |
| Game players (ingest) | `POST /api/games/{gameId}/game-players` — register session (**Bearer ingest token** only); returns `playerId` for `X-Player-Id` |
| Integration ping | `POST /api/games/{gameId}/integration` — validate **Bearer ingest token** only (body `{"validation":"ok"}`; no `X-Player-Id`); `GET /api/games/{gameId}/integration/status` (session, owner) — last ping time for the dashboard |
| Game exceptions | `GET/POST /api/games/{gameId}/game-exceptions` (session), `POST .../game-exceptions/ingest` (**Bearer + X-Player-Id**), `GET .../game-exceptions/interval?fromMs=&toMs=` |
| Trace heatmap | `GET /api/games/{gameId}/game-trace` (session, owner) — list trace points; `POST /api/games/{gameId}/game-trace/ingest` — create trace point (**Bearer + X-Player-Id**); body may include optional `gameEventId` |
| Game event definitions | `GET/POST /api/games/{gameId}/game-event-definitions`, `PUT/DELETE /api/games/{gameId}/game-event-definitions/{id}` (session, owner) — each definition includes optional **`color`** (`#RRGGBB`, default `#818cf8`) |
| Game events | `GET /api/games/{gameId}/game-events` (session, owner) — list occurrences; optional query **`q`**, **`code`**, **`limit`**. `POST /api/games/{gameId}/game-events/ingest` — create occurrence (**Bearer + X-Player-Id**) |
| Game feedback | `GET/POST /api/games/{gameId}/game-feedback-meter-definitions`, `PUT/DELETE .../{id}` (session); `GET /api/games/{gameId}/game-feedback`, `GET .../game-feedback/{id}` (session); `POST .../game-feedback/ingest` (**Bearer + X-Player-Id**) |
| Ingest token | `GET /api/games/{gameId}/ingest-token`, `POST /api/games/{gameId}/ingest-token/regenerate` (session, owner) |

**Game event templates:** each definition has a `messageTemplate` (max 100 characters) with placeholders like `<PLAYER_ID>`, `<KEY>`, `<VALUE>`, `<MAP>`, `<X>`, `<Y>`, `<Z>`. The ingest body provides `definitionCode` and a `parameters` map; keys are matched case-insensitively and normalized to uppercase for substitution. Any placeholder in the template must have a corresponding parameter or the API returns `400`. Optional `imageData` is a data URL or base64; images are validated to at most **16×16** pixels. Recorded `GameEvent` rows store the rendered text (max 100 characters) and the parameter payload as JSON. List responses include the definition’s current **`definitionColor`** for UI swatches.

**Breaking change:** older unscoped paths (`/api/features`, `/api/game-exceptions`, etc.) are removed; clients must authenticate and pass `gameId`.

## Database migrations

- Changelog root: [`src/main/resources/db/changelog/db.changelog-master.xml`](../src/main/resources/db/changelog/db.changelog-master.xml)
- SQL increments: [`src/main/resources/db/changelog/migrations/`](../src/main/resources/db/changelog/migrations/)

Liquibase `0006_users_games_multitenancy.sql` introduces `users` and `games`, assigns existing rows to a bootstrap **legacy** user/game for migration (plaintext password in DB is for **local/testing only** — replace via normal registration flow for real accounts).

## Tests

- Location: `src/test/java/com/example/api/`
- Example suites: `GameExceptionControllerTest`, `TraceControllerTest` (JUnit + Spring test support from starter-test).

## Configuration & secrets

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DB_URL` | recommended | `jdbc:postgresql://localhost:5432/numb_tracker` | JDBC URL |
| `DB_USERNAME` | recommended | `numb_tracker` | DB role |
| `DB_PASSWORD` | **yes** | — | No default; the app fails fast if unset |
| `SERVER_PORT` | no | `8080` | HTTP port |

Copy [`.env.example`](../.env.example) to `.env` and edit. `.env`, build output (`target/`), and `annotations.md` are git-ignored — see [`.gitignore`](../.gitignore). Workspace-level `.env`, `.env.example`, and `docker-compose.yml` exist at the repo root for orchestrated runs.

## Run (local)

From `gdtracker-api/`:

```bash
cp .env.example .env       # first time only, fill in values
set -a && source .env && set +a
mvn spring-boot:run
```

Requires a reachable PostgreSQL instance matching `DB_URL`.

## Docker

[`Dockerfile`](../Dockerfile) is a multi-stage build (Maven build → `eclipse-temurin:21-jre` runtime, runs as non-root). Build/run from `gdtracker-api/`:

```bash
docker build -t gdtracker-api:local .
docker run --rm -p 8080:8080 \
    -e DB_URL="jdbc:postgresql://host.docker.internal:5432/numb_tracker" \
    -e DB_USERNAME="numb_tracker" \
    -e DB_PASSWORD="change-me" \
    gdtracker-api:local
```

For a one-command spin-up of Postgres + backend + frontend, use the workspace `docker-compose.yml`.
