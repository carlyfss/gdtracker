# Database migrations (Go API)

## Authority for `gdtracker-go-api`

On startup (unless `GDTRACKER_GO_AUTO_MIGRATE=off`), the Go binary runs **embedded golang-migrate** SQL from `internal/db/migrations/` and records versions in **`schema_migrations`**.

Legacy databases may still contain Liquibase’s **`databasechangelog`** table from older deployments; that does **not** disable Go migrations anymore.

Historical Spring/Liquibase sources (reference only): [`gdtracker-api/src/main/resources/db/changelog/`](../../gdtracker-api/src/main/resources/db/changelog/).

## Inventory (early versions mirror legacy Liquibase order)

Go migrations **000001–000023** historically mirrored Spring changelog order. **000024+** are Go-first increments.

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
| 24 | `000024_game_event_definition_example_placeholders.sql` | `example_placeholder_values` JSONB on `game_event_definitions` |

## Go embedded migrations (`golang-migrate`)

Files live under `internal/db/migrations/` as `*_up.sql` / `*_down.sql`.

On startup, migrations run on a **separate** Postgres pool opened from the same DSN as the app. That avoids golang-migrate’s `Close()` shutting down the application’s primary `*sql.DB` (which would surface as `sql: database is closed` on the first API query).

**Note:** migrations `000019` and `000021` use `CREATE TABLE IF NOT EXISTS` so a **dirty repair** (force version then `Up` again) can succeed if the table was already created before the earlier failure. Fresh databases behave the same as plain `CREATE TABLE`.

**Note:** With `MultiStatementEnabled`, the driver splits the migration file on **every ASCII semicolon** (including inside `--` comments and string literals). Avoid `;` except as real statement terminators; `COMMENT` strings use a comma instead of a semicolon where the Liquibase original had one.

## Version tables

- **golang-migrate** uses **`schema_migrations`** (authoritative for what the Go binary applied).
- Legacy **Liquibase** may still have **`databasechangelog`**; do not use it to gate Go migrations.

**Operational rules:**

1. **Normal operation** — leave `GDTRACKER_GO_AUTO_MIGRATE` unset or `auto` / `on` so pending `internal/db/migrations` apply on startup.
2. **Disable binary migrations** — set `GDTRACKER_GO_AUTO_MIGRATE=off` only when you intentionally manage schema elsewhere (then apply the same DDL yourself).
3. Avoid running **Liquibase `update`** and **golang-migrate `up`** as competing writers against the same schema without a coordinated cutover plan.

## Dirty `schema_migrations` (failed migration)

If `migrate.Up` fails mid-file, golang-migrate marks that version **dirty** and refuses further `Up` until you fix it.

1. Fix the migration SQL in the repo (if that was the cause).
2. Set the version table to the **last known-good** version and clear dirty, then start again. Typical case: migration `000019` failed → force **18**, then `Up` reapplies 19+.

**Option A — env (one restart, only while `dirty` is true):**

The binary calls `migrate.Force` **only** if `schema_migrations.dirty` is true, so you can leave the variable unset after a successful run without resetting the version every boot.

```bash
export GDTRACKER_GO_MIGRATE_FORCE_VERSION=18
go run ./cmd/gdtracker-go-api
unset GDTRACKER_GO_MIGRATE_FORCE_VERSION
```

**Option B — SQL:**

```sql
SELECT * FROM schema_migrations;
UPDATE schema_migrations SET version = 18, dirty = false;
```

If migration 19 actually created objects before failing, drop them manually or use `migrate` CLI `down` from a clean backup—**dev DB** can be wiped if unsure.

## Environment variables

Same env as the app: `DB_URL` (`postgresql://host:port/dbname[?query]`), `DB_USERNAME`, `DB_PASSWORD`. See [`README.md`](README.md).
