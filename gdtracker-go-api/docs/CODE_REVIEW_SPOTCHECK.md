# Spot-check: error response shapes (Spring vs Go)

**Scope:** Ingest and session-related routes where clients might assume Spring-style JSON validation bodies.

## Findings (brief)

- **Spring** often returns `400` with a structured body (e.g. `MethodArgumentNotValid` / `BindingResult`) for invalid JSON or bean validation.
- **Go** handlers in `gdtracker-go-api` frequently return **plain text** or small custom JSON maps per handler, not a shared `{ "fieldErrors": ... }` envelope.
- **Impact:** Strict clients that parse only Spring’s validation JSON may need updates when pointed at the Go API. The shipped **`gdtracker-web`** should be verified route-by-route if ingest or auth flows show parse errors after cutover.
- **Action:** No Go change required unless a concrete client breaks; prefer aligning **OpenAPI** + web client to actual Go responses when issues are found.
