import { api } from './client'

export type GameEventTraceEntry = {
    id: string | number
    location: string
    map: string
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
