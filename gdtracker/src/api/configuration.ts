import { api } from './client'

export type CategorySummary = {
    id: string
    name: string
    color: string
}

export type GameConfiguration = {
    featureFlags: Record<string, boolean>
    settings: Record<string, string | number | boolean>
    defaultExceptionTaskCategoryId: string | null
    defaultExceptionTaskCategory: CategorySummary | null
}

export type GameConfigurationPatchBody = {
    featureFlags: Record<string, boolean>
    settings: Record<string, string | number | boolean>
    defaultExceptionTaskCategoryId: string | null
}

function base(gameId: string) {
    return `/api/games/${encodeURIComponent(gameId)}/configuration`
}

export async function getConfiguration(gameId: string): Promise<GameConfiguration> {
    const res = await api.get(base(gameId))
    return res.data as GameConfiguration
}

export async function patchConfiguration(gameId: string, body: GameConfigurationPatchBody): Promise<GameConfiguration> {
    const res = await api.patch(base(gameId), body)
    return res.data as GameConfiguration
}
