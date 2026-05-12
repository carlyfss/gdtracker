# Phase 2 route inventory (Spring → Go)

Session auth unless noted. **404** when `gameId` is not owned by the current user (GameAccessService parity).

## Games (`GameController`)

| Method | Path | Auth | Spring |
|--------|------|------|--------|
| GET | `/api/games` | Session | `GameController.listGames` |
| POST | `/api/games` | Session + CSRF | `GameController.createGame` |

## Ingest token (`GameIngestTokenController`)

| Method | Path | Auth | Spring |
|--------|------|------|--------|
| GET | `/api/games/{gameId}/ingest-token` | Session | `getStatus` |
| POST | `/api/games/{gameId}/ingest-token/regenerate` | Session + CSRF | `regenerate` |

## Categories (`CategoryController`)

| Method | Path | Auth | Spring |
|--------|------|------|--------|
| GET | `/api/games/{gameId}/categories` | Session | `listCategories` |
| POST | `/api/games/{gameId}/categories` | Session + CSRF | `createCategory` |
| PUT | `/api/games/{gameId}/categories/{id}` | Session + CSRF | `updateCategory` |
| DELETE | `/api/games/{gameId}/categories/{id}` | Session + CSRF | `deleteCategory` |

## Tags (`TagController`)

| Method | Path | Auth | Spring |
|--------|------|------|--------|
| GET | `/api/games/{gameId}/tags` | Session | `listTags` |
| POST | `/api/games/{gameId}/tags` | Session + CSRF | `createTag` |
| PUT | `/api/games/{gameId}/tags/{id}` | Session + CSRF | `updateTag` |
| DELETE | `/api/games/{gameId}/tags/{id}` | Session + CSRF | `deleteTag` |

## Tasks (`TaskController`)

| Method | Path | Auth | Spring |
|--------|------|------|--------|
| GET | `/api/games/{gameId}/tasks` | Session | `listTasks` (query: featureId, status, categoryId, tagIds[], tagMode, sourceGameExceptionId, archivedOnly) |
| POST | `/api/games/{gameId}/tasks` | Session + CSRF | `createTask` |
| PUT | `/api/games/{gameId}/tasks/{id}` | Session + CSRF | `updateTask` |
| DELETE | `/api/games/{gameId}/tasks/{id}` | Session + CSRF | `deleteTask` |
| POST | `/api/games/{gameId}/tasks/{id}/archive` | Session + CSRF | `archiveTask` |
| POST | `/api/games/{gameId}/tasks/{id}/unarchive` | Session + CSRF | `unarchiveTask` |

## Game exceptions (`GameExceptionController` + ingest)

| Method | Path | Auth | Spring |
|--------|------|------|--------|
| GET | `/api/games/{gameId}/game-exceptions` | Session | `listGameExceptions` |
| GET | `/api/games/{gameId}/game-exceptions/interval` | Session | `listGameExceptionsInInterval` (fromMs, toMs) |
| GET | `/api/games/{gameId}/game-exceptions/search` | Session | `searchGameExceptions` (q, page, size; size clamped 1–100, default 10) |
| GET | `/api/games/{gameId}/game-exceptions/{exceptionId}` | Session | `getGameException` |
| POST | `/api/games/{gameId}/game-exceptions/{exceptionId}/reserve-task-index` | Session + CSRF | `reserveExceptionTaskIndex` |
| POST | `/api/games/{gameId}/game-exceptions` | Session + CSRF | `reportGameException` |
| POST | `/api/games/{gameId}/game-exceptions/ingest` | **Bearer ingest + `X-Player-Id`** (no session / CSRF) | `GameExceptionIngestController.ingest` |

## Planning nodes (Go-only)

| Method | Path | Auth | Notes |
|--------|------|------|------|
| GET | `/api/games/{gameId}/planning-nodes` | Session | Flat list metadata (no bodies) |
| GET | `/api/games/{gameId}/planning-nodes/{id}` | Session | Full node + markdown / Excalidraw JSON |
| POST | `/api/games/{gameId}/planning-nodes` | Session + CSRF | Create folder, markdown, or excalidraw |
| PUT | `/api/games/{gameId}/planning-nodes/{id}` | Session + CSRF | Partial update |
| DELETE | `/api/games/{gameId}/planning-nodes/{id}` | Session + CSRF | Delete (cascades children via FK) |

## OpenAPI (canonical contract elsewhere)

Spring canonical: [`gdtracker-api/docs/openapi.yaml`](../../gdtracker-api/docs/openapi.yaml). Go mirror: [`openapi.yaml`](./openapi.yaml).
