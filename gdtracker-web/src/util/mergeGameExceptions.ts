import type { GameException } from '../api/gameExceptions'

export function exceptionTimestampMs(ex: GameException): number | null {
    const raw = ex.timestamp ?? ex.createdAt
    if (raw == null) return null
    const date = new Date(raw as string | number | Date)
    if (Number.isNaN(date.getTime())) return null
    return date.getTime()
}

export function mergeGameExceptions(
    existing: GameException[],
    incoming: GameException[]
): { merged: GameException[]; latestMs: number } {
    const byId = new Map<string, GameException>()
    let latestMs = 0

    const add = (ex: GameException) => {
        const id = ex.id != null ? String(ex.id) : ''
        if (id) byId.set(id, ex)
        const ms = exceptionTimestampMs(ex)
        if (ms != null && ms > latestMs) latestMs = ms
    }

    for (const ex of existing) add(ex)
    for (const ex of incoming) add(ex)

    const merged = Array.from(byId.values())
    merged.sort((a, b) => (exceptionTimestampMs(b) ?? 0) - (exceptionTimestampMs(a) ?? 0))
    return { merged, latestMs }
}
