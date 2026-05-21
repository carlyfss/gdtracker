import { api } from './client'

export type GameSummary = {
    id: string
    name: string
}

export type DeletedGameSummary = {
    id: string
    name: string
    taskCount: number
    exceptionCount: number
    documentCount: number
}

export type GamePurgePreview = {
    gameName: string
    features: string[]
    tasks: string[]
    documents: string[]
    featuresMore: number
    tasksMore: number
    documentsMore: number
}

type ApiGameDeleteStats = {
    tasks?: number
    gameExceptions?: number
    planningNodes?: number
}

type ApiDeletedGameSummary = {
    id: string
    name: string
    stats: ApiGameDeleteStats
}

type ApiCappedStringList = {
    items?: string[]
    more?: number
}

type ApiGamePurgePreview = {
    name: string
    features: ApiCappedStringList
    tasks: ApiCappedStringList
    planningNodes: ApiCappedStringList
}

function mapDeletedGameSummary(raw: ApiDeletedGameSummary): DeletedGameSummary {
    return {
        id: raw.id,
        name: raw.name,
        taskCount: raw.stats?.tasks ?? 0,
        exceptionCount: raw.stats?.gameExceptions ?? 0,
        documentCount: raw.stats?.planningNodes ?? 0,
    }
}

function mapGamePurgePreview(raw: ApiGamePurgePreview): GamePurgePreview {
    return {
        gameName: raw.name,
        features: raw.features?.items ?? [],
        featuresMore: raw.features?.more ?? 0,
        tasks: raw.tasks?.items ?? [],
        tasksMore: raw.tasks?.more ?? 0,
        documents: raw.planningNodes?.items ?? [],
        documentsMore: raw.planningNodes?.more ?? 0,
    }
}

export async function listGames(): Promise<GameSummary[]> {
    const res = await api.get<GameSummary[]>('/api/games')
    return Array.isArray(res.data) ? res.data : []
}

export async function createGame(name: string): Promise<GameSummary> {
    const res = await api.post<GameSummary>('/api/games', { name })
    return res.data as GameSummary
}

export async function softDeleteGame(id: string): Promise<void> {
    await api.delete(`/api/games/${encodeURIComponent(id)}`)
}

export async function listDeletedGames(): Promise<DeletedGameSummary[]> {
    const res = await api.get<ApiDeletedGameSummary[]>('/api/games/deleted')
    const rows = Array.isArray(res.data) ? res.data : []
    return rows.map(mapDeletedGameSummary)
}

export async function restoreGame(id: string): Promise<void> {
    await api.post(`/api/games/${encodeURIComponent(id)}/restore`)
}

export async function getGamePurgePreview(id: string): Promise<GamePurgePreview> {
    const res = await api.get<ApiGamePurgePreview>(`/api/games/${encodeURIComponent(id)}/purge-preview`)
    return mapGamePurgePreview(res.data)
}

export async function permanentlyDeleteGame(id: string): Promise<void> {
    await api.delete(`/api/games/${encodeURIComponent(id)}/permanent`)
}
