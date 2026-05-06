import { api } from './client'

export type GameException = {
    id?: string
    errorMessage?: string
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
