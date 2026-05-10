import { api } from './client'

export type GameEventTraceEntry = {
    id: string | number
    location: string
    map: string
    playerId?: string | null
    gameEventId?: string | null
    renderedMessage?: string | null
    definitionCode?: string | null
    definitionColor?: string | null
}

function url(gameId: string) {
    return `/api/games/${encodeURIComponent(gameId)}/game-trace`
}

export async function getLocationHeatmap(gameId: string): Promise<GameEventTraceEntry[]> {
    const res = await api.get(url(gameId))
    return Array.isArray(res.data) ? (res.data as GameEventTraceEntry[]) : []
}

export async function getLocationHeatmapForPlayer(gameId: string, playerId: string): Promise<GameEventTraceEntry[]> {
    const pid = playerId.trim()
    const res = await api.get(url(gameId), { params: pid.length > 0 ? { playerId: pid } : undefined })
    return Array.isArray(res.data) ? (res.data as GameEventTraceEntry[]) : []
}
