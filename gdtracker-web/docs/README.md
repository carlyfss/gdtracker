# GDTracker (gdtracker-web) — project guidance

Vite + React SPA for **GDTracker**: dashboard (exceptions + feature progress), trace heatmap, tasks, archive (archived features + tasks), and per-game configuration (feature flags, hierarchical features, categories, tags). Auth, game selection, and game-scoped dashboard routes are defined in [`src/App.tsx`](../src/App.tsx) with supporting modules under `src/context/` and `src/components/`.

**Start here**

- This file — structure, stack, how the app talks to the API.
- [DESIGN.md](DESIGN.md) — visual standards / design tokens (colors, typography); keep in sync with `src/index.css` and theme code.
- [FEATURES.md](FEATURES.md) — route → page → API client mapping.

## Directory map

| Path              | Role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/App.tsx`     | Top-level `<Routes>`: login, games hub, game creation, nested `/g/:gameId/*` dashboard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `src/main.tsx`    | `BrowserRouter` + `AuthProvider`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/context/`    | `AuthContext` (session user), `GameIdContext` (current game for API calls)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/components/` | `ProtectedRoute`, `GameDashboardLayout` (header nav + outlet), shared UI (`TaskDescriptionMarkdown`, `DashboardFeatureTreePanel`, `FeatureTasksModal`, `TagTasksModal`), shared icon set in `components/icons/`                                                                                                                                                                                                                                                                                                                                                                    |
| `src/pages/`      | `LoginPage`, `GamesHubPage`, `GameCreatePage`, plus dashboard pages (`DashboardPage`, `HeatmapPage`, `TasksPage`, `PlanningPage`, `ArchivePage`, `FeedbackPage`, `IntegrationPage`, `ConfigurationPage`). Larger pages have a per-page subfolder for components/utils: `pages/configuration/` (sections + `configurationUtils.ts`), `pages/tasks/` (filter panel, list table, modal + `tasksPageUtils.ts`), `pages/dashboard/` (exception search panel, detail panel + `dashboardPageUtils.ts`), `pages/planning/` (`PlanningPage`, `PlanningExcalidrawPanel`, `planningPage.css`) |
| `src/api/`        | Axios `client.ts` (credentials + CSRF header), `auth.ts`, `games.ts`, and game-scoped domain modules                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/util/`       | Pure TypeScript helpers (e.g. tree/feature helpers, `taskStatus.ts`, `hexColor.ts`)—no React imports unless necessary for that helper                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `docs/DESIGN.md`  | Visual standards index (semantic CSS variables, typography, pointers to shell layout); update when tokens or theme behavior changes                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Shared utilities & reuse

**Before** copying UI or logic into a second file, search **`src/util/`**, **`src/api/`**, **`src/components/`**, and any **custom hooks** (e.g. under `src/hooks/` if present).

| Kind of reuse                                             | Where                                     |
| --------------------------------------------------------- | ----------------------------------------- |
| Pure functions (formatting, parsing, non-UI data helpers) | `src/util/`                               |
| HTTP and API-specific calls                               | `src/api/` (build on `client.ts`)         |
| Repeated UI blocks                                        | Shared components under `src/components/` |
| Repeated state / effects                                  | Custom hooks (colocate or `src/hooks/`)   |

The workspace rule **`code-reuse-dry`** applies to all edits here—extract shared logic when the same non-trivial pattern appears in more than one place, and update this section or the directory map when you add a notable new reusable module.

## Stack and decisions

| Topic   | Choice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout  | Full-width shell with **16px** horizontal inset on the top header and main content (see [`src/App.css`](../src/App.css)); game routes also include a **left icon sidebar** (Dashboard / Heatmap / Tasks / Integration / Configuration) that fills the available height below the header. Sidebar labels appear as overlay tooltips on hover/focus (no layout shift). `.appShell` is a column flex layout so the body fills the viewport below the header. Game dashboard sections use `.gamePageSection` / `.gamePageStack` instead of floating `.card` panels. Games hub column scales with `.gamesHub`. |
| Build   | Vite + TypeScript + React                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Routing | `react-router-dom` — `/login`, `/games`, `/games/new`, `/g/:gameId/{dashboard,heatmap,tasks,planning,archive,feedback,integration,configuration}`; legacy `/g/:gameId/exceptions` redirects to `dashboard`; legacy `features` redirects to `configuration`                                                                                                                                                                                                                                                                                                                                                |
| HTTP    | `axios` via [`src/api/client.ts`](../src/api/client.ts). **Session** (`VITE_AUTH_MODE=session`): `withCredentials: true`, CSRF via `XSRF-TOKEN` / `X-XSRF-TOKEN`. **Auth0** (`auth0`): Bearer token from `@auth0/auth0-react`. Dev `baseURL` is `''` (Vite proxy). Production: `VITE_API_BASE_URL`.                                                                                                                                                                                                                                                                                                        |
| Auth0   | Set `VITE_AUTH_MODE=auth0` and `VITE_AUTH0_*` in the **repo root** `.env` (Vite `envDir` points there). Auth0 Dashboard URLs and audience: [`gdtracker-go-api/docs/AUTH0_LOCAL_DEV.md`](../../gdtracker-go-api/docs/AUTH0_LOCAL_DEV.md). API: [`AUTH.md`](../../gdtracker-go-api/docs/AUTH.md).                                                                                                                                                                                                                                                                                                            |
| Go API  | Point `VITE_DEV_PROXY_TARGET` at the Go listen address. Session mode: cookies + CSRF. Auth0 mode: `AUTH_MODE=auth0` on the API with matching `AUTH0_AUDIENCE`. See [`gdtracker-go-api/docs/AUTH.md`](../../gdtracker-go-api/docs/AUTH.md).                                                                                                                                                                                                                                                                                                                                                                 |
| Proxy   | [`vite.config.ts`](../vite.config.ts) proxies `/api` → `VITE_DEV_PROXY_TARGET`; loads env from repo root.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| PWA     | [`vite-plugin-pwa`](../vite.config.ts) — installable app (manifest + service worker). Precaches hashed build assets and SPA `navigateFallback` to `index.html` with `/api` on the denylist. **No Workbox runtime caching for `/api`** (online-only). Registration: [`src/main.tsx`](../src/main.tsx) via `virtual:pwa-register` (`registerType: 'autoUpdate'`). Raster icons: `public/pwa-*.png`. Verify with Chrome DevTools (Application / Manifest, Service Workers) or Lighthouse PWA after `npm run build` + `npm run preview`.                                                                      |
| License | **GPL-3.0-only** — workspace [`LICENSE`](../../LICENSE); `package.json` declares the same SPDX id.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## Format and lint

| Config                                            | Path                                          |
| ------------------------------------------------- | --------------------------------------------- |
| Prettier (120 cols, 4-space indent)               | [`prettier.config.js`](../prettier.config.js) |
| ESLint (flat config; Prettier conflicts disabled) | [`eslint.config.js`](../eslint.config.js)     |
| EditorConfig                                      | [`.editorconfig`](../.editorconfig)           |

From `gdtracker-web/`: `npm run format` (write), `npm run format:check`, `npm run lint`.

## Configuration & secrets

| Variable                | When                | Default                 | Notes                                                                        |
| ----------------------- | ------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| `VITE_DEV_PROXY_TARGET` | dev (`npm run dev`) | `http://localhost:8080` | Backend URL the dev server proxies `/api/*` to                               |
| `VITE_API_BASE_URL`     | production builds   | empty                   | Absolute API base URL **baked at build time**; no localhost fallback in prod |

Copy [`.env.example`](../.env.example) to `.env` and edit. `.env` and build output (`dist/`) are git-ignored; see [`.gitignore`](../.gitignore). The bundle never contains secrets — only public config such as the API base URL.

## Run (local)

From `gdtracker-web/` (with API on 8080 or proxy target adjusted):

```bash
cp .env.example .env       # first time only
npm install
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`). Ensure `gdtracker-api` is running and reachable at `VITE_DEV_PROXY_TARGET`.

## Docker

[`Dockerfile`](../Dockerfile) is a multi-stage build (Node build → nginx serving `dist/`). `VITE_API_BASE_URL` is a build arg baked into the bundle. From `gdtracker-web/`:

```bash
docker build --build-arg VITE_API_BASE_URL="http://localhost:8080" -t gdtracker-web:local .
docker run --rm -p 5173:80 gdtracker-web:local
```

For the orchestrated flow (Postgres + backend + frontend), use the workspace `docker-compose.yml`.
