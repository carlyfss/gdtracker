import { api } from './client'
import type { TaskStatus } from './tasks'

export type Feature = {
    id: string
    name: string
    description?: string | null
    status: TaskStatus
    color: string
    parentId?: string | null
    archived?: boolean
    archivedAt?: string | null
}

export type FeatureUpsertBody = {
    name: string
    description?: string | null
    status?: TaskStatus
    color?: string
    parentId?: string | null
}

export type FeatureTaskProgressRow = {
    featureId: string
    totalDirect: number
    doneDirect: number
    rolledUpTotal: number
    rolledUpDone: number
}

function base(gameId: string) {
    return `/api/games/${encodeURIComponent(gameId)}/features`
}

export type ListFeaturesParams = {
    archived?: boolean
}

export async function listFeatures(gameId: string, params: ListFeaturesParams = {}): Promise<Feature[]> {
    const search = new URLSearchParams()
    if (params.archived === true) search.set('archived', 'true')
    const qs = search.toString()
    const url = qs ? `${base(gameId)}?${qs}` : base(gameId)
    const res = await api.get(url)
    return Array.isArray(res.data) ? (res.data as Feature[]) : []
}

export async function listFeatureTaskProgress(
    gameId: string,
    params: ListFeaturesParams = {}
): Promise<FeatureTaskProgressRow[]> {
    const search = new URLSearchParams()
    if (params.archived === true) search.set('archived', 'true')
    const qs = search.toString()
    const url = qs ? `${base(gameId)}/task-progress?${qs}` : `${base(gameId)}/task-progress`
    const res = await api.get(url)
    return Array.isArray(res.data) ? (res.data as FeatureTaskProgressRow[]) : []
}

export async function archiveFeature(gameId: string, id: string): Promise<void> {
    await api.post(`${base(gameId)}/${encodeURIComponent(id)}/archive`)
}

export async function unarchiveFeature(gameId: string, id: string): Promise<void> {
    await api.post(`${base(gameId)}/${encodeURIComponent(id)}/unarchive`)
}

export async function createFeature(gameId: string, body: FeatureUpsertBody): Promise<Feature> {
    const res = await api.post(base(gameId), body)
    return res.data as Feature
}

export async function updateFeature(gameId: string, id: string, body: FeatureUpsertBody): Promise<Feature> {
    const res = await api.put(`${base(gameId)}/${encodeURIComponent(id)}`, body)
    return res.data as Feature
}

export async function deleteFeature(gameId: string, id: string): Promise<void> {
    await api.delete(`${base(gameId)}/${encodeURIComponent(id)}`)
}
