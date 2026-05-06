/** Keep in sync with default `--accent` in `src/index.css` :root */
export const DEFAULT_ACCENT_HEX = '#478cbf'

/** Accepts `#RGB` or `#RRGGBB` for `settings.THEME_COLOR`; returns normalized `#rrggbb` or null */
export function parseThemeColorHex(raw: unknown): string | null {
    if (typeof raw !== 'string') return null
    const s = raw.trim()
    if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase()
    if (/^#[0-9a-f]{3}$/i.test(s)) {
        const x = s.slice(1)
        return `#${x[0]}${x[0]}${x[1]}${x[1]}${x[2]}${x[2]}`.toLowerCase()
    }
    return null
}
