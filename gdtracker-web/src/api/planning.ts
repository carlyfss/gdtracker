import { api } from './client'

export type PlanningKind = 'folder' | 'markdown' | 'excalidraw'

export type PlanningNodeMeta = {
    id: string
    parentId: string | null
    kind: PlanningKind
    name: string
    sortOrder: number
    createdAt: string
    updatedAt: string
}

export type PlanningNodeDetail = PlanningNodeMeta & {
    markdownBody: string | null
    excalidrawScene: Record<string, unknown> | null
}

export type PlanningNodeCreateBody = {
    parentId?: string | null
    kind: PlanningKind
    name: string
    markdownBody?: string | null
    excalidrawScene?: Record<string, unknown> | null
}

export type PlanningNodeUpdateBody = {
    name?: string
    parentId?: string | null
    sortOrder?: number
    markdownBody?: string
    excalidrawScene?: Record<string, unknown> | null
}

function base(gameId: string) {
    return `/api/games/${encodeURIComponent(gameId)}/planning-nodes`
}

function normalizeMeta(raw: Record<string, unknown>): PlanningNodeMeta {
    return {
        id: String(raw.id ?? ''),
        parentId: raw.parentId == null ? null : String(raw.parentId),
        kind: raw.kind as PlanningKind,
        name: String(raw.name ?? ''),
        sortOrder: Number(raw.sortOrder ?? 0),
        createdAt: String(raw.createdAt ?? ''),
        updatedAt: String(raw.updatedAt ?? ''),
    }
}

function normalizeDetail(raw: Record<string, unknown>): PlanningNodeDetail {
    const meta = normalizeMeta(raw)
    let exc: Record<string, unknown> | null = null
    if (raw.excalidrawScene != null && typeof raw.excalidrawScene === 'object') {
        exc = raw.excalidrawScene as Record<string, unknown>
    }
    return {
        ...meta,
        markdownBody: raw.markdownBody == null ? null : String(raw.markdownBody),
        excalidrawScene: exc,
    }
}

export async function listPlanningNodes(gameId: string): Promise<PlanningNodeMeta[]> {
    const res = await api.get(base(gameId))
    if (!Array.isArray(res.data)) {
        return []
    }
    return (res.data as Record<string, unknown>[]).map((row) => normalizeMeta(row))
}

export async function getPlanningNode(gameId: string, id: string): Promise<PlanningNodeDetail> {
    const res = await api.get(`${base(gameId)}/${encodeURIComponent(id)}`)
    return normalizeDetail(res.data as Record<string, unknown>)
}

export async function createPlanningNode(gameId: string, body: PlanningNodeCreateBody): Promise<PlanningNodeDetail> {
    const res = await api.post(base(gameId), body)
    return normalizeDetail(res.data as Record<string, unknown>)
}

export async function updatePlanningNode(
    gameId: string,
    id: string,
    body: PlanningNodeUpdateBody
): Promise<PlanningNodeDetail> {
    const res = await api.put(`${base(gameId)}/${encodeURIComponent(id)}`, body)
    return normalizeDetail(res.data as Record<string, unknown>)
}

export async function deletePlanningNode(gameId: string, id: string): Promise<void> {
    await api.delete(`${base(gameId)}/${encodeURIComponent(id)}`)
}
