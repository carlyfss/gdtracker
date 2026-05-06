import { api } from './client'

export type GameSummary = {
    id: string
    name: string
}

export async function listGames(): Promise<GameSummary[]> {
    const res = await api.get<GameSummary[]>('/api/games')
    return Array.isArray(res.data) ? res.data : []
}

export async function createGame(name: string): Promise<GameSummary> {
    const res = await api.post<GameSummary>('/api/games', { name })
    return res.data as GameSummary
}
