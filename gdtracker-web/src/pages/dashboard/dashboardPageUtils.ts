import type { GameException } from '../../api/gameExceptions'

export function exceptionTimeFor(item: GameException): Date | null {
    const raw = item.timestamp ?? item.createdAt
    if (raw == null) return null
    const date = new Date(raw as string | number | Date)
    if (Number.isNaN(date.getTime())) return null
    return date
}

export function titleForException(ex: GameException): string {
    const short =
        typeof ex.shortErrorMessage === 'string' && ex.shortErrorMessage.trim().length > 0
            ? ex.shortErrorMessage.trim()
            : null
    if (short) return short
    const msg =
        typeof ex.errorMessage === 'string' && ex.errorMessage.trim().length > 0 ? ex.errorMessage : 'Unknown error'
    return msg
}

export function subtitleForException(ex: GameException): string {
    const parts: string[] = []
    const t = exceptionTimeFor(ex)
    if (t) parts.push(t.toLocaleString())
    if (typeof ex.map === 'string' && ex.map) parts.push(ex.map)
    if (typeof ex.location === 'string' && ex.location) parts.push(ex.location)
    return parts.join(' • ')
}
