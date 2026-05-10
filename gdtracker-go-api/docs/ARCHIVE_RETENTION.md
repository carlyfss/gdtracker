# Archive retention (Spring parity)

The Go API runs an **in-process** daily job that purges **archived** tasks and features past the per-game TTL. This replaces Spring’s `ArchiveRetentionService` when only `gdtracker-go-api` is deployed.

## Schedule

- Default run time: **03:17** in the configured timezone (matches Spring cron `0 17 3 * * *`: second 0, minute 17, hour 3).
- Default timezone: **UTC** (Spring used the JVM’s default zone; operators should set the Go timezone explicitly so behavior is predictable).
- The job does **not** run at process startup unless that moment is already the scheduled time; it waits for the next slot.

## TTL (`ARCHIVE_TIME_BOMB`)

- Read from `game_configurations.settings` JSON, key **`ARCHIVE_TIME_BOMB`** (same as Spring).
- If missing, invalid, zero, or negative: **30** days.
- Positive numeric and decimal JSON numbers use the integer part (same as narrowing from `Number` in Java).
- String values: parsed as base-10 integer; invalid strings fall back to 30.

## Deletes (semantics)

Per game, in order:

1. Tasks with `archived_at IS NOT NULL` and `archived_at` before `now - N days`, scoped through **`features.game_id`** (not `tasks.game_id`).
2. Features with `archived_at IS NOT NULL` and `archived_at` before the same cutoff.

Repository helpers: `TaskRepository.DeleteArchivedByGameBeforeCutoff`, `FeatureRepository.DeleteArchivedByGameBeforeCutoff`.

## Multi-replica behavior

Each purge pass uses **`pg_try_advisory_lock`** on a fixed 64-bit key so **at most one** connected instance deletes per run. Others log a skip line and exit the pass.

## Environment variables

| Variable | Meaning |
|----------|---------|
| `GDTRACKER_ARCHIVE_RETENTION` | If `false`, `0`, `off`, or `no` (case-insensitive), the scheduler is **disabled**. Omit or any other value: **enabled** (when DB is configured). |
| `GDTRACKER_ARCHIVE_RETENTION_TIMEZONE` | IANA name (e.g. `America/New_York`). Invalid names fall back to **UTC**. Default `UTC`. |
| `GDTRACKER_ARCHIVE_RETENTION_HOUR` | Hour `0–23` (default **3**). |
| `GDTRACKER_ARCHIVE_RETENTION_MINUTE` | Minute `0–59` (default **17**). |

If Postgres is not configured (`DB_URL` unset), the retention goroutine is **not** started.

## Tests

- Unit tests: `internal/retention/archive_days_test.go`, `config_test.go`.
- Integration: set `GDTRACKER_GO_TEST_DB=1` and `DB_URL` / `DB_USERNAME` / `DB_PASSWORD`, use a **disposable** database, then `go test ./internal/retention/ -run Integration`.
