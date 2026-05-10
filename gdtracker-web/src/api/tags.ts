import { api } from './client'

export type Tag = {
    id: string
    name: string
    color: string
    description?: string | null
}

export type TagUpsertBody = {
    name: string
    color?: string
    description?: string | null
}

function base(gameId: string) {
    return `/api/games/${encodeURIComponent(gameId)}/tags`
}

export async function listTags(gameId: string): Promise<Tag[]> {
    const res = await api.get(base(gameId))
    return Array.isArray(res.data) ? (res.data as Tag[]) : []
}

export async function createTag(gameId: string, body: TagUpsertBody): Promise<Tag> {
    const res = await api.post(base(gameId), body)
    return res.data as Tag
}

export async function updateTag(gameId: string, id: string, body: TagUpsertBody): Promise<Tag> {
    const res = await api.put(`${base(gameId)}/${encodeURIComponent(id)}`, body)
    return res.data as Tag
}

export async function deleteTag(gameId: string, id: string): Promise<void> {
    await api.delete(`${base(gameId)}/${encodeURIComponent(id)}`)
}
