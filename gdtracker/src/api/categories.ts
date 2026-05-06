import { api } from './client'

export type Category = {
    id: string
    name: string
    color: string
}

export type CategoryUpsertBody = {
    name: string
    color?: string
}

function base(gameId: string) {
    return `/api/games/${encodeURIComponent(gameId)}/categories`
}

export async function listCategories(gameId: string): Promise<Category[]> {
    const res = await api.get(base(gameId))
    return Array.isArray(res.data) ? (res.data as Category[]) : []
}

export async function createCategory(gameId: string, body: CategoryUpsertBody): Promise<Category> {
    const res = await api.post(base(gameId), body)
    return res.data as Category
}

export async function updateCategory(gameId: string, id: string, body: CategoryUpsertBody): Promise<Category> {
    const res = await api.put(`${base(gameId)}/${encodeURIComponent(id)}`, body)
    return res.data as Category
}

export async function deleteCategory(gameId: string, id: string): Promise<void> {
    await api.delete(`${base(gameId)}/${encodeURIComponent(id)}`)
}
