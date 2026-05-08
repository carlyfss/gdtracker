# `gdtracker-go-api` docs

## What lives here
- **OpenAPI**: `docs/openapi.yaml` (update this whenever routes/req/resp/status codes change)

## Directory map (code)
```
gdtracker-go-api/
├── cmd/gdtracker-go-api/ # entrypoint
├── controller/          # HTTP handlers (when you add more endpoints)
├── service/             # business logic
├── repository/          # persistence-facing logic
├── db/                  # DB wiring/migrations (if/when added)
├── model/               # domain models
├── util/                # stateless helpers
└── internal/httpx/      # small HTTP helpers (private)
```

## Common commands
```bash
cd gdtracker-go-api
gofmt -w .
go test ./...
go run ./cmd/gdtracker-go-api
```
