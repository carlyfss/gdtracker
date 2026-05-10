# Phase 2 implementation design (Go)

## Order

1. **Repositories** (`internal/repository/`) — `database/sql`, parameterized queries only. Shared helpers for game ownership checks at the handler layer (`requireOwnedGame`).
2. **Games + bootstrap** — `GameSetupService`-equivalent: `game_configurations` row + default “Game exceptions” category when a game is created.
3. **Categories + tags** — CRUD + conflict/not-found semantics matching controllers.
4. **Tasks** — Filter listing ported from `TaskRepository` JPQL to SQL; tag normalization (ANY / ALL); create/update/delete; parent cycle walk; `ArchiveService` parity for task archive/unarchive (including archived-feature branch via `archived_features` / restored copy).
5. **Exceptions** — CRUD/search/interval/reserve-index SQL; ingest uses `auth.VerifyIngestToken` + `game_players` existence.
6. **OpenAPI** — Extend `docs/openapi.yaml` for every new path.
7. **Frontend** — `gdtracker-web` already targets `/api/...`; verify proxy/env only.

## Error mapping

- Not authenticated → **401** (text/plain short message).
- Wrong game / missing owned resource → **404** (“game not found”, “task not found”, etc.) to avoid IDOR enumeration.
- Validation → **400**; duplicate name → **409**; FK / in-use → **409** where Spring used `CONFLICT`.
- Ingest auth failures → **401** per `IngestHttpSupport` / `GameIngestTokenService`.

## Testing

- **Unit**: `internal/util/colorhex` (or `internal/httpx` neighbor) for `#RRGGBB` validation.
- **HTTP**: `httptest` + real Postgres when `GDTRACKER_GO_TEST_DB=1` and `DB_*` env set; otherwise skip, so default `go test` stays hermetic.
