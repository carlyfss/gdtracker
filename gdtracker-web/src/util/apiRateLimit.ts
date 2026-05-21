import { isAxiosError } from 'axios'

export function parseRetryAfterSeconds(err: unknown): number | null {
    if (!isAxiosError(err)) return null
    if (err.response?.status !== 429) return null
    const raw = err.response.headers?.['retry-after']
    const value = Array.isArray(raw) ? raw[0] : raw
    if (value == null) return null
    const n = Number.parseInt(String(value), 10)
    return Number.isFinite(n) && n > 0 ? n : null
}

export function nextBackoffMs(currentMs: number, retryAfterSec: number | null, capMs: number): number {
    if (retryAfterSec != null) {
        return Math.min(capMs, retryAfterSec * 1000)
    }
    const doubled = currentMs > 0 ? currentMs * 2 : 15_000
    return Math.min(capMs, doubled)
}
