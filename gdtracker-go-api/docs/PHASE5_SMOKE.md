# Phase 5 manual smoke (frontend)

Run `gdtracker-go-api` with a real Postgres (migrations applied). In `gdtracker-web`, point the dev proxy at the Go API (`/api` → Go origin). Log in, pick a game, then verify:

1. **Integration** — Integration page polls `GET .../integration/status` without errors; with a valid ingest token, `POST .../integration` with `{"validation":"ok"}` updates status when exercised from a client.
2. **Game events** — Configuration → game events: list/create/edit/delete definitions; dashboard or events UI lists and searches events.
3. **Heatmap** — Heatmap tab loads traces; filters by player when applicable.
4. **Feedback** — Feedback tab lists summaries and opens detail; meter definitions CRUD works.

If any response shape differs from Spring, fix the Go handler (preferred) or adjust the web client only for a confirmed contract bug.
