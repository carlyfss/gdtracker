# Phase 2 code review (Go routes)

## Authorization

- Session routes use `requireOwnedGame` → `games.FindByIDAndOwner`; wrong game returns **404** (Spring parity, avoids IDOR enumeration).
- Ingest uses `games.FindByID` then `auth.VerifyIngestToken` and `game_players` existence; missing game → **404**, bad token → **401**.

## SQL injection / bounds

- Task/category/tag queries use bound parameters only.
- Exception search `LIMIT`/`OFFSET` are formatted from clamped `int` page/size (not user strings).
- Search `LIKE` pattern uses user `q` inside parameterized pattern (same trade-off as Spring JPQL `CONCAT`).

## Pagination

- Exception search clamps `size` to 1–100 and `page` to ≥0, matching `GameExceptionController`.

## Follow-ups (optional hardening)

- Add integration tests behind `GDTRACKER_GO_TEST_DB=1` for list/create task + exception search.
- Consider wrapping multi-step archive/unarchive in stricter isolation if concurrent edits become an issue.
