# GDTracker — visual standards

Reference for **colors, typography, and where layout is documented**. Implementation lives in CSS/TS; this file tracks the **current contract** so agents and humans can search without reading every stylesheet.

## Source of truth

| Area            | Files                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Global tokens   | [`src/index.css`](../src/index.css) (`:root`, headings, `code`)                                                                |
| App chrome / UI | [`src/App.css`](../src/App.css)                                                                                                |
| Per-game accent | [`src/theme/defaults.ts`](../src/theme/defaults.ts), [`src/context/GameThemeContext.tsx`](../src/context/GameThemeContext.tsx) |

**Maintenance:** Update this document whenever [`src/index.css`](../src/index.css), theme-related behavior, or documented layout/spacing standards change.

---

## Colors (CSS variables)

Semantic tokens are set on `:root` in [`src/index.css`](../src/index.css). **`--accent`** and derived **`--accent-*`** respond to the accent hue; other tokens are neutrals and surfaces.

### Default dark (`color-scheme: dark`)

| Variable          | Role                     | Default (dark)   |
| ----------------- | ------------------------ | ---------------- |
| `--text`          | Body text                | `#a1a1aa`        |
| `--text-h`        | Headings / emphasis text | `#fafafa`        |
| `--bg`            | Page background          | `#0b0b0f`        |
| `--panel`         | Panel surface            | `#111118`        |
| `--panel-2`       | Secondary panel          | `#151522`        |
| `--border`        | Borders                  | `#27272a`        |
| `--code-bg`       | Inline `code` background | `#14141d`        |
| `--accent`        | Primary / brand accent   | `#478cbf`        |
| `--accent-2`      | Lighter accent (mix)     | `color-mix(...)` |
| `--accent-bg`     | Subtle accent fill       | `color-mix(...)` |
| `--accent-border` | Accent-tinted borders    | `color-mix(...)` |
| `--shadow`        | Elevation shadow         | (see CSS)        |

### Light mode (`prefers-color-scheme: light`)

The same variable **names** are reassigned in `@media (prefers-color-scheme: light)` in [`src/index.css`](../src/index.css) (e.g. `--text` `#4b5563`, `--bg` `#ffffff`, `--accent` `#366994`). **`--accent-2`**, **`--accent-bg`**, and **`--accent-border`** are still derived from `--accent` via `color-mix`.

### Per-game accent

- Default accent matches **`DEFAULT_ACCENT_HEX`** in [`src/theme/defaults.ts`](../src/theme/defaults.ts) and default `--accent` in `:root`.
- On game dashboard routes, [`GameThemeContext`](../src/context/GameThemeContext.tsx) may set **`document.documentElement` style `--accent`** from game configuration **`settings.THEME_COLOR`** (CSS hex; validated with `parseThemeColorHex` in that context). Configure the key in the **Settings** table on [`ConfigurationPage`](../src/pages/ConfigurationPage.tsx). When set, derived accent variables in CSS still follow `var(--accent)`.

**Form focus:** Shared **`.textInput`**, **`.textArea`**, **`.intervalSelect`**, and **`.authInput`** use **`border-color: var(--accent)`** and **`box-shadow: 0 0 0 3px var(--accent-bg)`** on **`:focus`** in [`App.css`](../src/App.css) so focus rings follow the current accent (including per-game theme).

---

## Typography

| Token       | Use                | Value (from [`index.css`](../src/index.css)) |
| ----------- | ------------------ | -------------------------------------------- |
| `--sans`    | UI / body          | `system-ui, 'Segoe UI', Roboto, sans-serif`  |
| `--heading` | `h1`, `h2`         | Same stack as `--sans`                       |
| `--mono`    | `code`, `.counter` | `ui-monospace, Consolas, monospace`          |

| Element / scope | Rules                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| `:root`         | `font: 18px/145% var(--sans)`; `letter-spacing: 0.18px`; at **max-width 1024px**, `font-size: 16px`. |
| `h1`            | `56px`, weight `500`; **≤1024px**: `36px`, adjusted margins.                                         |
| `h2`            | `24px`, line-height `118%`; **≤1024px**: `20px`.                                                     |
| `code`          | `15px`, line-height `135%`, `padding: 4px 8px`, `border-radius: 4px`, `background: var(--code-bg)`.  |

---

## Layout and shell

Spacing, header inset (**16px**), sidebar, and dashboard section patterns are described in **[`docs/README.md`](README.md)** (Stack and decisions → Layout) and implemented in **[`src/App.css`](../src/App.css)** (e.g. `.appShell`, `.appHeader`, `.gamePageSection`). Prefer linking here rather than duplicating long layout prose.

---

## Charts and components

Charts (e.g. Recharts) often use **`var(--accent-2)`** or event-specific colors; see page components under [`src/pages/`](../src/pages/) for details.

**Task tags:** filled pill styling lives under **`.tagChip`** / **`.tagChipInteractive`** / **`.tasksTagCell`** in [`src/App.css`](../src/App.css); foreground vs fill uses [`chipTextColor`](../src/util/chipTextColor.ts).

**Integration page:** instructional panels use **`.integrationSection*`**; the live validation block uses **`.integrationValidationPanel`** with **`data-state="idle"`** (neutral border, **`.integrationValidationIdleDot`**), **`data-state="waiting"`** (amber tint, **`.integrationThrobber`**), and **`data-state="ok"`** (green tint, check). Warnings use **`.integrationWarn`**. Implemented in [`src/App.css`](../src/App.css); page: [`IntegrationPage.tsx`](../src/pages/IntegrationPage.tsx). Sidebar raster icons (Archive, Feedback, Integration, Configuration): **`.appSidebarRasterIcon`** in [`GameDashboardLayout.tsx`](../src/components/GameDashboardLayout.tsx); primary nav still uses vector **`.appSidebarIcon svg`** icons.

**Feedback page:** page **`.gamePageStack`** with **`.feedbackPageSplit`** (50/50 grid, single column under **960px**); template table and inbox list share **`.gamePageSection`** / **`.cardHeader`** / **`.cardBody`**. Detail view uses the shared **`.modalBackdrop`** / **`.modalCard`** pattern. Page: [`FeedbackPage.tsx`](../src/pages/FeedbackPage.tsx).
