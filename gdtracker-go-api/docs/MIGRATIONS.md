# Database migrations (Go API)

## Source of truth (Spring / Liquibase)

The production schema is defined by **Liquibase** in the Spring Boot project:

- Master changelog: [`gdtracker-api/src/main/resources/db/changelog/db.changelog-master.xml`](../../gdtracker-api/src/main/resources/db/changelog/db.changelog-master.xml)
- SQL increments: [`gdtracker-api/src/main/resources/db/changelog/migrations/`](../../gdtracker-api/src/main/resources/db/changelog/migrations/)

Runtime queries (not migrations) live under `gdtracker-api/src/main/resources/sql/`.

## Inventory (0001–0023)

Order matches `db.changelog-master.xml`.

| # | File | Purpose |
|---|------|---------|
| 1 | `0001_create_features.sql` | `features` table with unique name |
| 2 | `0002_create_tasks.sql` | `tasks` linked to features |
| 3 | `0003_create_trace_locations.sql` | `trace_locations` + timestamp index |
| 4 | `0004_create_game_exceptions.sql` | `game_exceptions` + timestamp index |
| 5 | `0005_alter_features_add_description_status_color.sql` | Feature description, status, color |
| 6 | `0006_users_games_multitenancy.sql` | `users`, `games`, `game_id` on tenant tables, legacy bootstrap rows, indexes |
| 7 | `0007_categories_and_game_configuration.sql` | `categories`, `game_configurations`, seed rows |
| 8 | `0008_tasks_category.sql` | `tasks.category_id` + FK |
| 9 | `0009_game_events_and_ingest_token.sql` | Ingest token columns on `games`, `game_event_definitions`, `game_events` |
| 10 | `0010_game_event_definition_color.sql` | Definition color column |
| 11 | `0011_rename_trace_locations.sql` | Rename to `game_event_traces`, optional `game_event_id` FK |
| 12 | `0012_features_parent_subfeatures.sql` | Feature hierarchy + partial unique indexes |
| 13 | `0013_tasks_parent_subtasks.sql` | Task parent + `ON DELETE CASCADE` |
| 14 | `0014_tags_and_task_tags.sql` | `tags`, `task_tags` |
| 15 | `0015_exception_task_template_and_task_source_exception.sql` | JSON template on config; `tasks.source_game_exception_id` |
| 16 | `0016_feature_task_archived.sql` | `archived` boolean on features/tasks |
| 17 | `0017_game_players_feedback_ingest.sql` | Players, feedback schema, player FKs on events/traces/exceptions |
| 18 | `0018_game_last_integration_validation.sql` | `games.last_integration_validation_at` |
| 19 | `0019_game_exception_task_sequences.sql` | Per-exception task index sequence table |
| 20 | `0020_game_exceptions_short_error_message.sql` | `short_error_message` column |
| 21 | `0021_game_exception_task_sequences_per_game.sql` | Per-game sequence table |
| 22 | `0022_archive_timebomb_and_archive_tables.sql` | `archived_at`, archive mirror tables, backfill |
| 23 | `0023_tasks_feature_fk_cascade_delete.sql` | `tasks` → `features` FK `ON DELETE CASCADE` |

## Go mirror (`golang-migrate`)

The Go service ships the **same SQL** as 23 sequential `golang-migrate` versions under `internal/db/migrations/` (`*_up.sql` / `*_down.sql`). Strips Liquibase metadata only; SQL bodies match the Java project.

## Migration authority (do not double-apply)

- **Liquibase** records changes in `databasechangelog` (default table name).
- **golang-migrate** uses `schema_migrations`.

**Rules:**

1. **Database already managed by Spring / Liquibase** — do **not** run Go `migrate up` on that database unless you are doing a deliberate cutover and have a written plan (baseline or fresh DB). Prefer `GDTRACKER_GO_AUTO_MIGRATE=off` (default) so the Go binary does not apply migrations.
2. **Greenfield / Go-only Postgres** — set `GDTRACKER_GO_AUTO_MIGRATE=on` (or `auto` when `databasechangelog` is absent) so the app applies `internal/db/migrations` on startup, **or** run the migrate CLI against the DSN (see README).
3. Never run Liquibase and golang-migrate **both** against the same database for the same logical schema without reconciling their version tables.

## Environment variables

Same as Spring: `DB_URL` (JDBC `jdbc:postgresql://...`), `DB_USERNAME`, `DB_PASSWORD`. See [`README.md`](README.md).
