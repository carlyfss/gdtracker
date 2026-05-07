import { api } from './client'

export type GameException = {
    id?: string
    errorMessage?: string
    shortErrorMessage?: string
    location?: string
    map?: string
    timestamp?: string | number | Date
    createdAt?: string | number | Date
    stackTrace?: string
    [key: string]: unknown
}

function base(gameId: string) {
    return `/api/games/${encodeURIComponent(gameId)}/game-exceptions`
}

export async function listGameExceptions(gameId: string): Promise<GameException[]> {
    const res = await api.get(base(gameId))
    return Array.isArray(res.data) ? (res.data as GameException[]) : []
}

export async function listGameExceptionsInterval(
    gameId: string,
    fromMs: number,
    toMs: number
): Promise<GameException[]> {
    const res = await api.get(`${base(gameId)}/interval`, { params: { fromMs, toMs } })
    return Array.isArray(res.data) ? (res.data as GameException[]) : []
}

export async function getGameException(gameId: string, exceptionId: string): Promise<GameException> {
    const res = await api.get(`${base(gameId)}/${encodeURIComponent(exceptionId)}`)
    return res.data as GameException
}

export async function reserveExceptionTaskIndex(gameId: string, exceptionId: string): Promise<number> {
    const res = await api.post(`${base(gameId)}/${encodeURIComponent(exceptionId)}/reserve-task-index`)
    const raw = res.data as { index?: number }
    if (typeof raw?.index !== 'number' || !Number.isFinite(raw.index)) {
        throw new Error('reserve-task-index: invalid response')
    }
    return raw.index
}
