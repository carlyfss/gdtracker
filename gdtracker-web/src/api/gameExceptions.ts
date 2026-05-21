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

export type GameExceptionsSincePage = {
    items: GameException[]
    latestMs: number
}

export async function listGameExceptionsSince(
    gameId: string,
    sinceMs: number,
    limit = 200
): Promise<GameExceptionsSincePage> {
    const res = await api.get(`${base(gameId)}/since`, { params: { sinceMs, limit } })
    const raw = res.data as Partial<GameExceptionsSincePage> | null
    return {
        items: Array.isArray(raw?.items) ? (raw!.items as GameException[]) : [],
        latestMs: typeof raw?.latestMs === 'number' && Number.isFinite(raw.latestMs) ? raw.latestMs : sinceMs,
    }
}

export async function listGameExceptionsInterval(
    gameId: string,
    fromMs: number,
    toMs: number
): Promise<GameException[]> {
    const res = await api.get(`${base(gameId)}/interval`, { params: { fromMs, toMs } })
    return Array.isArray(res.data) ? (res.data as GameException[]) : []
}

export type GameExceptionPage = {
    content: GameException[]
    totalElements: number
    totalPages: number
    number: number
    size: number
}

export async function searchGameExceptions(
    gameId: string,
    params: { q?: string; page?: number; size?: number } = {}
): Promise<GameExceptionPage> {
    const query: Record<string, string | number> = {}
    if (typeof params.q === 'string' && params.q.trim().length > 0) query.q = params.q.trim()
    if (typeof params.page === 'number' && Number.isFinite(params.page))
        query.page = Math.max(0, Math.floor(params.page))
    if (typeof params.size === 'number' && Number.isFinite(params.size))
        query.size = Math.max(1, Math.floor(params.size))

    const res = await api.get(`${base(gameId)}/search`, { params: query })
    const raw = res.data as Partial<GameExceptionPage> | null
    return {
        content: Array.isArray(raw?.content) ? (raw!.content as GameException[]) : [],
        totalElements: typeof raw?.totalElements === 'number' ? raw!.totalElements : 0,
        totalPages: typeof raw?.totalPages === 'number' ? raw!.totalPages : 0,
        number: typeof raw?.number === 'number' ? raw!.number : 0,
        size: typeof raw?.size === 'number' ? raw!.size : 0,
    }
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
