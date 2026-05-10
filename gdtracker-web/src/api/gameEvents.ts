import { api } from './client'

export type GameEventDefinition = {
    id: string
    code: string
    displayName?: string | null
    messageTemplate: string
    imageData?: string | null
    color?: string
}

export type GameEventDefinitionUpsertBody = {
    code: string
    displayName?: string | null
    messageTemplate: string
    imageData?: string | null
    color?: string | null
}

export type GameEvent = {
    id: string
    definitionId: string
    definitionCode: string
    definitionColor: string
    playerId?: string | null
    renderedMessage: string
    payload: Record<string, string>
    timestamp: string
}

export type GameEventPage = {
    content: GameEvent[]
    totalElements: number
    totalPages: number
    number: number
    size: number
}

export type ListGameEventsParams = {
    q?: string
    code?: string
    limit?: number
}

export type SearchGameEventsParams = {
    q?: string
    code?: string
    playerId?: string
    page?: number
    size?: number
}

export type IngestTokenStatus = {
    configured: boolean
    createdAt?: string | null
}

export type IngestTokenRegenerateResponse = {
    token: string
    createdAt?: string | null
}

function definitionsBase(gameId: string) {
    return `/api/games/${encodeURIComponent(gameId)}/game-event-definitions`
}

function eventsBase(gameId: string) {
    return `/api/games/${encodeURIComponent(gameId)}/game-events`
}

function ingestTokenBase(gameId: string) {
    return `/api/games/${encodeURIComponent(gameId)}/ingest-token`
}

export async function listGameEventDefinitions(gameId: string): Promise<GameEventDefinition[]> {
    const res = await api.get(definitionsBase(gameId))
    return Array.isArray(res.data) ? (res.data as GameEventDefinition[]) : []
}

export async function createGameEventDefinition(
    gameId: string,
    body: GameEventDefinitionUpsertBody
): Promise<GameEventDefinition> {
    const res = await api.post(definitionsBase(gameId), body)
    return res.data as GameEventDefinition
}

export async function updateGameEventDefinition(
    gameId: string,
    id: string,
    body: GameEventDefinitionUpsertBody
): Promise<GameEventDefinition> {
    const res = await api.put(`${definitionsBase(gameId)}/${encodeURIComponent(id)}`, body)
    return res.data as GameEventDefinition
}

export async function deleteGameEventDefinition(gameId: string, id: string): Promise<void> {
    await api.delete(`${definitionsBase(gameId)}/${encodeURIComponent(id)}`)
}

export async function listGameEvents(gameId: string, params?: ListGameEventsParams): Promise<GameEvent[]> {
    const query: Record<string, string | number> = {}
    if (params?.q != null && params.q.trim().length > 0) {
        query.q = params.q.trim()
    }
    if (params?.code != null && params.code.trim().length > 0) {
        query.code = params.code.trim()
    }
    if (params?.limit != null) {
        query.limit = params.limit
    }
    const res = await api.get(eventsBase(gameId), { params: Object.keys(query).length > 0 ? query : undefined })
    return Array.isArray(res.data) ? (res.data as GameEvent[]) : []
}

export async function searchGameEvents(gameId: string, params: SearchGameEventsParams = {}): Promise<GameEventPage> {
    const query: Record<string, string | number> = {}
    if (typeof params.q === 'string' && params.q.trim().length > 0) query.q = params.q.trim()
    if (typeof params.code === 'string' && params.code.trim().length > 0) query.code = params.code.trim()
    if (typeof params.playerId === 'string' && params.playerId.trim().length > 0)
        query.playerId = params.playerId.trim()
    if (typeof params.page === 'number' && Number.isFinite(params.page))
        query.page = Math.max(0, Math.floor(params.page))
    if (typeof params.size === 'number' && Number.isFinite(params.size))
        query.size = Math.max(1, Math.floor(params.size))

    const res = await api.get(`${eventsBase(gameId)}/search`, { params: query })
    const raw = res.data as Partial<GameEventPage> | null
    return {
        content: Array.isArray(raw?.content) ? (raw!.content as GameEvent[]) : [],
        totalElements: typeof raw?.totalElements === 'number' ? raw!.totalElements : 0,
        totalPages: typeof raw?.totalPages === 'number' ? raw!.totalPages : 0,
        number: typeof raw?.number === 'number' ? raw!.number : 0,
        size: typeof raw?.size === 'number' ? raw!.size : 0,
    }
}

export async function getIngestTokenStatus(gameId: string): Promise<IngestTokenStatus> {
    const res = await api.get(ingestTokenBase(gameId))
    return res.data as IngestTokenStatus
}

export async function regenerateIngestToken(gameId: string): Promise<IngestTokenRegenerateResponse> {
    const res = await api.post(`${ingestTokenBase(gameId)}/regenerate`)
    return res.data as IngestTokenRegenerateResponse
}
