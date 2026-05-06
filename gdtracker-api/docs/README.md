# GDTracker API — project guidance

REST API for GDTracker: game exceptions, trace heatmap data, tasks, and product features. Consumed by the `gdtracker` Vite app (proxied `/api` in dev).

**Start here**

- [OVERVIEW.md](OVERVIEW.md) — layout, stack, REST surface, DB and migrations, tests.
- [FEATURES.md](FEATURES.md) — domain areas mapped to code and Liquibase scripts.
- [openapi.yaml](openapi.yaml) — OpenAPI 3 contract; **update in the same change** when routes or request/response shapes change (include examples; no real secrets).
