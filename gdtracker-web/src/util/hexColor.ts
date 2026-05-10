const HEX6_PATTERN = /^#[0-9A-Fa-f]{6}$/

/**
 * True when {@code value} is a valid 6-digit hex color (`#RRGGBB`).
 */
export function isHex6(value: string | null | undefined): value is string {
    return typeof value === 'string' && HEX6_PATTERN.test(value)
}

/**
 * Returns the lowercased hex color when valid, otherwise the supplied fallback.
 */
export function normalizeHex6(value: string | null | undefined, fallback: string): string {
    return isHex6(value) ? value.toLowerCase() : fallback
}
