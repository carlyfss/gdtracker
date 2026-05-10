# gdtracker-api

Spring Boot REST API that backs the [gdtracker-web](../gdtracker-web/) frontend. It receives game exception reports, trace/heatmap events, game events, and exposes endpoints for tasks, features, categories, and per-game configuration. PostgreSQL is the only supported database; the schema is managed by Liquibase.

## Stack

- Java 21
- Spring Boot 3.2 (Web, Validation, Data JPA, Security)
- PostgreSQL + Liquibase
- Maven (with Spotless + Checkstyle)

## Prerequisites

- JDK 21
- Maven 3.9+
- PostgreSQL 14+ (local install, container, or remote — see below)
- Docker (optional, for the containerized flow)

## Configuration

All credentials and connection details come from environment variables. There are no secrets in the source tree.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DB_URL` | recommended | `jdbc:postgresql://localhost:5432/numb_tracker` | JDBC URL of the database |
| `DB_USERNAME` | recommended | `numb_tracker` | DB role used by the API |
| `DB_PASSWORD` | **yes** | — | Password for `DB_USERNAME`; the app will not start without it |
| `SERVER_PORT` | no | `8080` | HTTP port the server listens on |

Copy [`.env.example`](./.env.example) to `.env` and fill in the values. `.env` is git-ignored.

```bash
cp .env.example .env
# then edit .env with your local DB credentials
```

## Running locally

### 1. Start a PostgreSQL instance

The fastest path is the workspace-level `docker-compose.yml` (see the [workspace README](../README.md)). To run only Postgres:

```bash
docker run -d --name gdtracker-pg \
  -e POSTGRES_USER=numb_tracker \
  -e POSTGRES_PASSWORD=change-me \
  -e POSTGRES_DB=numb_tracker \
  -p 5432:5432 \
  -v gdtracker-pgdata:/var/lib/postgresql/data \
  postgres:16-alpine
```

Then in your `.env`:

```env
DB_URL=jdbc:postgresql://localhost:5432/numb_tracker
DB_USERNAME=numb_tracker
DB_PASSWORD=change-me
```

### 2. Run the API

Spring Boot reads variables from the process environment, so export your `.env` before running Maven:

```bash
set -a && source .env && set +a
mvn spring-boot:run
```

The API will be available at `http://localhost:${SERVER_PORT:-8080}`. Liquibase runs all changesets on first start.

### Build a JAR

```bash
mvn clean package
java -jar target/gdtracker-api-0.0.1-SNAPSHOT.jar
```

## Docker

### Build the image

From the project root:

```bash
docker build -t gdtracker-api:local .
```

The Dockerfile is multi-stage (Maven build → minimal `eclipse-temurin:21-jre` runtime) and runs as a non-root user.

### Run the image

```bash
docker run --rm -p 8080:8080 \
  -e DB_URL="jdbc:postgresql://host.docker.internal:5432/numb_tracker" \
  -e DB_USERNAME="numb_tracker" \
  -e DB_PASSWORD="change-me" \
  gdtracker-api:local
```

`host.docker.internal` resolves to the host machine on Docker Desktop; on Linux pass `--add-host=host.docker.internal:host-gateway`. To talk to a Postgres on another machine, use that hostname in `DB_URL` instead.

### Or use the workspace compose

For one-command spin-up of Postgres + backend + frontend, use the `docker-compose.yml` at the workspace root. See the [workspace README](../README.md).

## Tests

```bash
mvn test                 # all tests
mvn test -q              # quiet
mvn test -Dtest=GameExceptionControllerTest
```

Tests load the same `application.properties` as the runtime. Either point them at a disposable Postgres or override per-test with `@TestPropertySource` / `application-test.properties`.

## Format & lint

```bash
mvn spotless:apply       # auto-format
mvn checkstyle:check     # check style
```

## Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Auth |
| GET  | `/api/auth/me` | Current user |
| GET/POST/PUT/DELETE | `/api/games` | Games CRUD |
| GET/POST | `/api/games/{gameId}/game-exceptions` | Game exception reports (JSON may include optional `shortErrorMessage`) |
| POST | `/api/games/{gameId}/game-exceptions/ingest` | Ingest (Bearer + `X-Player-Id`; body may include optional `shortErrorMessage`) |
| GET/POST | `/api/games/{gameId}/game-trace`, `POST /game-trace/ingest` | Trace points + ingest |
| GET/POST | `/api/games/{gameId}/game-events`, `POST /game-events/ingest` | Game events + ingest |
| GET/POST/PUT/DELETE | `/api/games/{gameId}/game-event-definitions` | Event definitions |
| GET/POST/PUT/DELETE | `/api/games/{gameId}/tasks` | Tasks CRUD |
| GET/POST/PUT/DELETE | `/api/games/{gameId}/features` | Features CRUD |
| GET/POST/PUT/DELETE | `/api/games/{gameId}/categories` | Categories CRUD |
| GET/PUT | `/api/games/{gameId}/configuration` | Per-game configuration |
| POST | `/api/games/{gameId}/ingest-token/regenerate` | Rotate ingest token |

See `src/main/java/com/example/api/controller/` for the authoritative list.

## Security notes (read before deploying anywhere public)

This project ships with **deliberately weak auth designed for local development**. Do not run it on the public internet without addressing both items below.

- **Plaintext password storage** — user passwords are stored as-is via `PlainTextPasswordEncoder` ([source](src/main/java/com/example/api/security/PlainTextPasswordEncoder.java)) and the `User.password` column. Replace with `BCryptPasswordEncoder` (already used for ingest tokens) before any non-local deployment.
- **Bootstrap user** — Liquibase changeset `0006_users_games_multitenancy.sql` inserts a user `legacy / legacy` for backfilling existing rows. Either delete this user after first start or remove that `INSERT` from the migration before deploying.
- **Database password rotation** — if you previously committed `application.properties` with a real password, treat that password as compromised and rotate it on the database server.

## Project layout

```
gdtracker-api/
├── src/main/java/com/example/api/
│   ├── controller/      REST controllers
│   ├── service/         Business logic
│   ├── repository/      Spring Data repositories
│   ├── model/           JPA entities
│   ├── dto/             Request/response DTOs
│   └── security/        Spring Security config + auth helpers
├── src/main/resources/
│   ├── application.properties
│   └── db/changelog/    Liquibase master + migrations
├── src/test/java/       Tests
├── docs/                Project guidance (overview, features, etc.)
├── Dockerfile
├── .env.example
└── pom.xml
```

## License

This project is licensed under the **GNU General Public License v3.0**. See the [workspace `LICENSE`](../LICENSE) file.
