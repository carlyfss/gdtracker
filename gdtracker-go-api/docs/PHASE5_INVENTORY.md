# Phase 5 route inventory (Spring → Go)

Session auth and **404** for wrong/missing owned `gameId` match Phase 2 (`GameAccessService` parity). Ingest routes use **Bearer** token (+ **`X-Player-Id`** where noted); CSRF exempt per `internal/httpserver/csrf.go`.

**Behavior sources (service parity, not only controllers):**  
`GameEventTemplateService`, `GameEventImageService`, `GameEventIngestService`, `TraceIngestService`, `GameFeedbackIngestService`, `GameFeedbackQueryService`, `IntegrationPingService`, `GamePlayerService` under `gdtracker-api/src/main/java/com/example/api/service/`.

## Ingest plane

| Method | Path | Auth | Spring |
|--------|------|------|--------|
| POST | `/api/games/{gameId}/game-players` | Bearer ingest | `GamePlayerRegisterController.register` |
| POST | `/api/games/{gameId}/integration` | Bearer ingest | `IntegrationController.ping` |
| GET | `/api/games/{gameId}/integration/status` | Session | `IntegrationController.status` |

## Game event definitions

| Method | Path | Auth | Spring |
|--------|------|------|--------|
| GET | `/api/games/{gameId}/game-event-definitions` | Session | `GameEventDefinitionController.listDefinitions` |
| POST | `/api/games/{gameId}/game-event-definitions` | Session + CSRF | `createDefinition` |
| PUT | `/api/games/{gameId}/game-event-definitions/{id}` | Session + CSRF | `updateDefinition` |
| DELETE | `/api/games/{gameId}/game-event-definitions/{id}` | Session + CSRF | `deleteDefinition` |

## Game events

| Method | Path | Auth | Spring |
|--------|------|------|--------|
| GET | `/api/games/{gameId}/game-events` | Session | `GameEventController.listGameEvents` |
| GET | `/api/games/{gameId}/game-events/search` | Session | `GameEventController.searchGameEvents` |
| POST | `/api/games/{gameId}/game-events/ingest` | Bearer + `X-Player-Id` | `GameEventIngestController.ingest` |

## Game trace (heatmap)

| Method | Path | Auth | Spring |
|--------|------|------|--------|
| GET | `/api/games/{gameId}/game-trace` | Session | `TraceController.getTraces` |
| POST | `/api/games/{gameId}/game-trace/ingest` | Bearer + `X-Player-Id` | `TraceIngestController.ingest` |

## Game feedback

| Method | Path | Auth | Spring |
|--------|------|------|--------|
| GET | `/api/games/{gameId}/game-feedback-meter-definitions` | Session | `GameFeedbackMeterDefinitionController.list` |
| POST | `/api/games/{gameId}/game-feedback-meter-definitions` | Session + CSRF | `create` |
| PUT | `/api/games/{gameId}/game-feedback-meter-definitions/{id}` | Session + CSRF | `update` |
| DELETE | `/api/games/{gameId}/game-feedback-meter-definitions/{id}` | Session + CSRF | `delete` |
| GET | `/api/games/{gameId}/game-feedback` | Session | `GameFeedbackController.list` |
| GET | `/api/games/{gameId}/game-feedback/{feedbackId}` | Session | `GameFeedbackController.getOne` |
| POST | `/api/games/{gameId}/game-feedback/ingest` | Bearer + `X-Player-Id` | `GameFeedbackIngestController.ingest` |

## OpenAPI

Canonical contract: [`openapi.yaml`](./openapi.yaml).
