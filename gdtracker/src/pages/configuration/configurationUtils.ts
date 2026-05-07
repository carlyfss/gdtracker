import { DEFAULT_ACCENT_HEX } from '../../theme/defaults'
import { normalizeHex6 } from '../../util/hexColor'

export type UiState =
    | { kind: 'idle' }
    | { kind: 'loading'; message: string }
    | { kind: 'error'; message: string }
    | { kind: 'success'; message: string }

export const DEFAULT_COLOR = DEFAULT_ACCENT_HEX

export function normalizeName(raw: string): string {
    return raw.trim().replace(/\s+/g, ' ')
}

export function isAxiosStatus(err: unknown, status: number): boolean {
    const e = err as { response?: { status?: number } } | null
    return e?.response?.status === status
}

export function normalizeHexColor(raw: string): string {
    return normalizeHex6(raw.trim(), DEFAULT_COLOR)
}
