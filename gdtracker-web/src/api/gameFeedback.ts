import { api } from './client'

export type GameFeedbackMeterDefinition = {
    id: string
    fieldKey: string
    question: string
    sortOrder: number
}

export type GameFeedbackMeterDefinitionUpsertBody = {
    fieldKey: string
    question: string
    sortOrder: number
}

export type GameFeedbackSummary = {
    id: string
    title: string
    playerId: string
    createdAt: string
}

export type GameFeedbackMeterValue = {
    fieldKey: string
    question: string
    value: number
}

export type GameFeedbackDetail = {
    id: string
    title: string
    description: string
    playerId: string
    createdAt: string
    meters: GameFeedbackMeterValue[]
}

function meterDefsBase(gameId: string) {
    return `/api/games/${encodeURIComponent(gameId)}/game-feedback-meter-definitions`
}

function feedbackBase(gameId: string) {
    return `/api/games/${encodeURIComponent(gameId)}/game-feedback`
}

export async function listGameFeedbackMeterDefinitions(gameId: string): Promise<GameFeedbackMeterDefinition[]> {
    const res = await api.get(meterDefsBase(gameId))
    return Array.isArray(res.data) ? (res.data as GameFeedbackMeterDefinition[]) : []
}

export async function createGameFeedbackMeterDefinition(
    gameId: string,
    body: GameFeedbackMeterDefinitionUpsertBody
): Promise<GameFeedbackMeterDefinition> {
    const res = await api.post(meterDefsBase(gameId), body)
    return res.data as GameFeedbackMeterDefinition
}

export async function updateGameFeedbackMeterDefinition(
    gameId: string,
    id: string,
    body: GameFeedbackMeterDefinitionUpsertBody
): Promise<GameFeedbackMeterDefinition> {
    const res = await api.put(`${meterDefsBase(gameId)}/${encodeURIComponent(id)}`, body)
    return res.data as GameFeedbackMeterDefinition
}

export async function deleteGameFeedbackMeterDefinition(gameId: string, id: string): Promise<void> {
    await api.delete(`${meterDefsBase(gameId)}/${encodeURIComponent(id)}`)
}

export async function listGameFeedbackSummaries(gameId: string): Promise<GameFeedbackSummary[]> {
    const res = await api.get(feedbackBase(gameId))
    return Array.isArray(res.data) ? (res.data as GameFeedbackSummary[]) : []
}

export async function getGameFeedbackDetail(gameId: string, feedbackId: string): Promise<GameFeedbackDetail> {
    const res = await api.get(`${feedbackBase(gameId)}/${encodeURIComponent(feedbackId)}`)
    return res.data as GameFeedbackDetail
}

export type RegisterIngestPlayerResponse = {
    playerId: string
}

/** Bearer ingest token only (no X-Player-Id). */
export async function registerIngestPlayer(gameId: string, ingestToken: string): Promise<RegisterIngestPlayerResponse> {
    const res = await api.post(
        `/api/games/${encodeURIComponent(gameId)}/game-players`,
        {},
        {
            headers: { Authorization: `Bearer ${ingestToken}` },
        }
    )
    return res.data as RegisterIngestPlayerResponse
}
