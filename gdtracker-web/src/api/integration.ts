import { api } from './client'

export type IntegrationStatus = {
    lastValidatedAt: string | null
}

export async function getIntegrationStatus(gameId: string): Promise<IntegrationStatus> {
    const res = await api.get(`/api/games/${encodeURIComponent(gameId)}/integration/status`)
    return res.data as IntegrationStatus
}
