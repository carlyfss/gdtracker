# gdtracker

Vite + React + TypeScript dashboard that consumes the [gdtracker-api](../gdtracker-api/) Spring Boot backend. Tracks game exceptions, trace heatmaps, game events, tasks, and per-game configuration.

## Stack

- React 19 + TypeScript
- Vite 8
- React Router 7
- Axios (session cookie + CSRF double-submit)
- Recharts (charts/heatmap)
- ESLint + Prettier

## Prerequisites

- Node.js 20+ and npm 10+
- A running [gdtracker-api](../gdtracker-api/) instance (locally or via the workspace compose)
- Docker (optional, for the containerized flow)

## Configuration

Vite reads variables prefixed with `VITE_` from a `.env` file at the project root. Copy [`.env.example`](./.env.example) to `.env`:

```bash
cp .env.example .env
```

| Variable                | When                     | Default                 | Description                                                                          |
| ----------------------- | ------------------------ | ----------------------- | ------------------------------------------------------------------------------------ |
| `VITE_DEV_PROXY_TARGET` | dev only (`npm run dev`) | `http://localhost:8080` | Backend URL the Vite dev server proxies `/api/*` to                                  |
| `VITE_API_BASE_URL`     | production builds        | empty (same origin)     | Absolute API base URL baked into the build (`npm run build`, the Docker image, etc.) |

Important: `VITE_API_BASE_URL` is **baked at build time**. Changing it requires a rebuild (or a fresh `docker compose build --no-cache frontend`).

## Run locally

### Dev server (HMR + proxy)

```bash
npm install
npm run dev
```

Opens on `http://localhost:5173`. Requests to `/api/*` are proxied to `VITE_DEV_PROXY_TARGET`.

### Production build

```bash
npm run build
npm run preview        # serves dist/ on a local port for sanity checks
```

## Format & lint

```bash
npm run format         # prettier write
npm run format:check   # prettier check
npm run lint           # eslint
```

## Docker

The provided [`Dockerfile`](./Dockerfile) is a multi-stage build (Node build → nginx serving the static bundle).

### Build

From the project root:

```bash
docker build \
    --build-arg VITE_API_BASE_URL="http://localhost:8080" \
    -t gdtracker:local .
```

### Run

```bash
docker run --rm -p 5173:80 gdtracker:local
```

Open `http://localhost:5173`. nginx is configured with an SPA fallback so React Router deep links work.

### Or use the workspace compose

The `docker-compose.yml` at the workspace root spins up Postgres + backend + frontend together with the right env wiring. See the [workspace README](../README.md).

## Project layout

```
gdtracker/
├── src/
│   ├── api/            Axios client + per-resource API modules
│   ├── components/     Shared UI
│   ├── context/        React contexts (auth, gameId)
│   ├── pages/          Route pages
│   ├── util/           Pure helpers
│   ├── App.tsx
│   └── main.tsx
├── public/             Static assets copied verbatim
├── docs/               Project guidance (overview, features)
├── Dockerfile
├── nginx.conf
├── .env.example
├── vite.config.ts
└── package.json
```

## License

This project is licensed under the **GNU General Public License v3.0**. See the [workspace `LICENSE`](../LICENSE) file.
