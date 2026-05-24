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

Semantic tokens are set on `:root` in [`src/index.css`](../src/index.css). **`--accent`** and derived **`--accent-*`** respond to the accent hue; surfaces use **neutral grayscale** (no blue-tinted panels).

### Flat color principle

Interactive surfaces (buttons, pills, list items, row highlights, banners) use **solid fills** where **border color equals background color**. Hover states step to **`--accent-hover`**, **`--surface-hover`**, or semantic `*-hover` tokens — not legacy purple/blue overlays or “lighter interior + darker border” pairs. **`--accent-bg`** is reserved for **focus rings** on form controls.

### Default dark (`color-scheme: dark`)

| Variable                               | Role                         | Default (dark)           |
| -------------------------------------- | ---------------------------- | ------------------------ |
| `--text`                               | Body text                    | `#a1a1aa`                |
| `--text-h`                             | Headings / emphasis text     | `#fafafa`                |
| `--text-muted`                         | Secondary / hint text        | `rgba(255,255,255,0.55)` |
| `--bg`                                 | Page background (flat)       | `#0b0b0f`                |
| `--panel`                              | Panel surface                | `#121212`                |
| `--panel-2`                            | Secondary panel              | `#1a1a1a`                |
| `--panel-elevated`                     | Raised inset panels          | `#161616`                |
| `--chrome-bg`                          | Header / sidebar             | `#121212`                |
| `--border`                             | Borders                      | `#2a2a2a`                |
| `--border-subtle`                      | Subtle dividers              | `#242424`                |
| `--code-bg`                            | Inline `code` background     | `#161616`                |
| `--surface-hover`                      | Neutral list/button hover    | `#1e1e1e`                |
| `--surface-active`                     | Neutral pressed/active       | `#252525`                |
| `--accent`                             | Primary / brand accent       | `#478cbf`                |
| `--accent-hover`                       | Accent hover (flat buttons)  | `color-mix(...)`         |
| `--accent-2`                           | Lighter accent (mix)         | `color-mix(...)`         |
| `--accent-bg`                          | Focus ring fill only         | `color-mix(...)`         |
| `--accent-border`                      | Accent border (= `--accent`) | `var(--accent)`          |
| `--success` / `--danger` / `--warning` | Semantic actions             | (see CSS)                |
| `--status-*`                           | Task status pill / done row  | (see CSS)                |
| `--shadow`                             | Elevation shadow             | (see CSS)                |

### Light mode (`prefers-color-scheme: light`)

The same variable **names** are reassigned in `@media (prefers-color-scheme: light)` in [`src/index.css`](../src/index.css) (e.g. `--text` `#4b5563`, `--bg` `#ffffff`, `--panel` `#f5f5f5`, `--accent` `#366994`). Hover mixes use white instead of black.

### Per-game accent

- Default accent matches **`DEFAULT_ACCENT_HEX`** in [`src/theme/defaults.ts`](../src/theme/defaults.ts) and default `--accent` in `:root`.
- On game dashboard routes, [`GameThemeContext`](../src/context/GameThemeContext.tsx) may set **`document.documentElement` style `--accent`** from game configuration **`settings.THEME_COLOR`** (CSS hex; validated with `parseThemeColorHex` in that context). Configure the key in the **Settings** table on [`ConfigurationPage`](../src/pages/ConfigurationPage.tsx). When set, derived accent variables in CSS still follow `var(--accent)`.

**Form focus:** Shared **`.textInput`**, **`.textArea`**, **`.intervalSelect`**, and **`.authInput`** use **`border-color: var(--accent)`** and **`box-shadow: 0 0 0 3px var(--accent-bg)`** on **`:focus`** / **`:focus-visible`** in [`App.css`](../src/App.css) so focus rings follow the current accent (including per-game theme).

---

## Typography

**Web font:** [Stack Sans Headline](https://fonts.google.com/specimen/Stack+Sans+Headline) (weights 200–700), loaded in [`index.html`](../index.html).

| Token       | Use                                                              | Value (from [`index.css`](../src/index.css))               |
| ----------- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| `--sans`    | UI / body                                                        | `'Stack Sans Headline', system-ui, 'Segoe UI', sans-serif` |
| `--heading` | `h1`, `h2`                                                       | Same stack as `--sans`                                     |
| `--mono`    | `code`, `.counter`, tokens, stack traces, markdown source editor | `ui-monospace, Consolas, monospace`                        |

| Element / scope | Rules                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| `:root`         | `font: 18px/145% var(--sans)`; `letter-spacing: 0.18px`; at **max-width 1024px**, `font-size: 16px`. |
| `h1`            | `56px`, weight `500`; **≤1024px**: `36px`, adjusted margins.                                         |
| `h2`            | `24px`, line-height `118%`; **≤1024px**: `20px`.                                                     |
| `code`          | `15px`, line-height `135%`, `padding: 4px 8px`, `border-radius: 4px`, `background: var(--code-bg)`.  |

**Form controls:** **`.textInput`**, **`.textArea`**, **`.intervalSelect`**, and **`.authInput`** share panel fill, border radius, and accent focus ring in [`App.css`](../src/App.css). Dropdowns use [`SelectControl`](../src/components/SelectControl.tsx): the trigger is a **`<button class="intervalSelect">`** (custom chevron); the open list is a portaled **`.selectControlMenu`** (rounded panel, accent hover) so option menus match app chrome on all platforms.

---

## Layout and shell

Breakpoints: **`--breakpoint-sm`** (640px), **`--breakpoint-md`** (768px), **`--breakpoint-lg`** (1024px) in [`src/styles/breakpoints.css`](../src/styles/breakpoints.css).

| Viewport      | Chrome                                                                                                                                                                                                                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **≥768px**    | [`AppAuthenticatedShell`](../src/components/AppAuthenticatedShell.tsx): **67px icon sidebar** + main (`.appSidebar`, tooltips on hover).                                                                                                                                                                   |
| **&lt;768px** | Same shell: **`.appMobileHeader`** (menu + breadcrumbs via [`AppMobileHeader`](../src/components/AppMobileHeader.tsx)) and **`.appNavDrawer`** overlay ([`AppNavDrawer`](../src/components/AppNavDrawer.tsx)). Game nav links share config in [`src/nav/gameNavConfig.tsx`](../src/nav/gameNavConfig.tsx). |

Main content padding **16px** (12px on mobile). Page background is flat **`var(--bg)`** — no radial gradient blobs on `.appShell` or auth fullscreen routes. Game routes use `.gamePageSection` / `.gamePageStack`. More detail: **[`docs/README.md`](README.md)** (Layout). Implementation: **[`src/App.css`](../src/App.css)** (`.appShell`, `.appMobileHeader`, `.appNavDrawer*`, responsive tasks/dashboard rules).

---

## Charts and components

Charts (e.g. Recharts) often use **`var(--accent-2)`** or event-specific colors; see page components under [`src/pages/`](../src/pages/) for details.

**Task tags:** filled pill styling lives under **`.tagChip`** / **`.tagChipInteractive`** / **`.tasksTagCell`** in [`src/App.css`](../src/App.css); foreground vs fill uses [`chipTextColor`](../src/util/chipTextColor.ts).

**Integration page:** instructional panels use **`.integrationSection*`**; the live validation block uses **`.integrationValidationPanel`** with flat **`data-state="idle"`** (neutral), **`data-state="waiting"`** (warning fill), and **`data-state="ok"`** (success fill). Warnings use **`.integrationWarn`**. Implemented in [`src/App.css`](../src/App.css); page: [`IntegrationPage.tsx`](../src/pages/IntegrationPage.tsx). Sidebar raster icons (Archive, Feedback, Integration, Configuration): **`.appSidebarRasterIcon`** in [`GameDashboardLayout.tsx`](../src/components/GameDashboardLayout.tsx); primary nav still uses vector **`.appSidebarIcon svg`** icons.

**Feedback page:** page **`.gamePageStack`** with **`.feedbackPageSplit`** (50/50 grid, single column under **960px**); template table and inbox list share **`.gamePageSection`** / **`.cardHeader`** / **`.cardBody`**. Detail view uses the shared **`.modalBackdrop`** / **`.modalCard`** pattern. Page: [`FeedbackPage.tsx`](../src/pages/FeedbackPage.tsx).
