/** Readable foreground (#000 / #fff) for text on a filled hex background (#RRGGBB). */
export function chipTextColor(backgroundHex: string): '#000000' | '#ffffff' {
    const hex = backgroundHex.trim().replace(/^#/, '')
    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
        return '#ffffff'
    }
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    // Relative luminance (sRGB), WCAG-style threshold
    const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    return y > 0.55 ? '#000000' : '#ffffff'
}
