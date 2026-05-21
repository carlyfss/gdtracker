import { api } from './client'
import type { Category } from './categories'
import type { Feature } from './features'
import type { Tag } from './tags'

export type TaskPlanningDocumentRef = {
    id: string
    name: string
    kind: 'markdown' | 'excalidraw'
}

export type TaskStatus = 'PENDING' | 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'DONE'

export type Task = {
    id: string
    title: string
    description?: string | null
    status: TaskStatus
    feature?: Feature
    featureId?: string
    category?: Category
    categoryId?: string
    tags?: Tag[]
    tagIds?: string[]
    parentTaskId?: string | null
    sourceGameExceptionId?: string | null
    planningDocumentRefs?: TaskPlanningDocumentRef[]
    createdAt?: string
    updatedAt?: string
    archived?: boolean
    archivedAt?: string | null
    [key: string]: unknown
}

function normalizePlanningDocumentRefs(raw: unknown): TaskPlanningDocumentRef[] {
    if (!Array.isArray(raw)) return []
    const out: TaskPlanningDocumentRef[] = []
    for (const row of raw) {
        if (!row || typeof row !== 'object') continue
        const o = row as Record<string, unknown>
        const id = typeof o.id === 'string' ? o.id : ''
        const name = typeof o.name === 'string' ? o.name : ''
        const kind = o.kind === 'markdown' || o.kind === 'excalidraw' ? o.kind : null
        if (!id || !kind) continue
        out.push({ id, name: name || id, kind })
    }
    return out
}

export function taskPlanningDocumentRefsFromApi(t: Task): TaskPlanningDocumentRef[] {
    const raw = (t as Record<string, unknown>).planningDocumentRefs
    return normalizePlanningDocumentRefs(raw)
}

export type ListTasksParams = {
    featureId?: string
    status?: TaskStatus
    categoryId?: string
    sourceGameExceptionId?: string
    tagIds?: string[]
    tagMode?: 'ANY' | 'ALL'
    archivedOnly?: boolean
}

export type ListTasksPageParams = ListTasksParams & {
    page?: number
    size?: number
    includeSubtasks?: boolean
    collapsedParentIds?: string[]
}

export type TaskListDisplayRow = {
    task: Task
    depth: number
    hasChildren: boolean
}

export type TaskListPage = {
    content: TaskListDisplayRow[]
    totalElements: number
    totalPages: number
    number: number
    size: number
}

export type UpsertTaskBody = {
    title: string
    description?: string | null
    status: TaskStatus
    featureId: string
    categoryId?: string | null
    tagIds?: string[]
    parentTaskId?: string | null
    sourceGameExceptionId?: string | null
    planningNodeIds?: string[]
}

function base(gameId: string) {
    return `/api/games/${encodeURIComponent(gameId)}/tasks`
}

function appendListTasksFilters(search: URLSearchParams, params: ListTasksParams): void {
    if (params.featureId) search.set('featureId', params.featureId)
    if (params.status) search.set('status', params.status)
    if (params.categoryId) search.set('categoryId', params.categoryId)
    if (params.sourceGameExceptionId) search.set('sourceGameExceptionId', params.sourceGameExceptionId)
    const tagIds = params.tagIds?.filter((id) => id.trim().length > 0) ?? []
    for (const id of tagIds) {
        search.append('tagIds', id)
    }
    if (tagIds.length >= 2 && params.tagMode) {
        search.set('tagMode', params.tagMode)
    }
    if (params.archivedOnly === true) {
        search.set('archivedOnly', 'true')
    }
}

function buildListTasksQuery(params: ListTasksParams): string {
    const search = new URLSearchParams()
    appendListTasksFilters(search, params)
    const qs = search.toString()
    return qs ? `?${qs}` : ''
}

export async function listTasks(gameId: string, params: ListTasksParams = {}): Promise<Task[]> {
    const url = `${base(gameId)}${buildListTasksQuery(params)}`
    const res = await api.get(url)
    return Array.isArray(res.data) ? (res.data as Task[]) : []
}

export async function listTasksPage(gameId: string, params: ListTasksPageParams = {}): Promise<TaskListPage> {
    const search = new URLSearchParams()
    appendListTasksFilters(search, params)
    if (typeof params.page === 'number' && Number.isFinite(params.page)) {
        search.set('page', String(Math.max(0, Math.floor(params.page))))
    }
    if (typeof params.size === 'number' && Number.isFinite(params.size)) {
        search.set('size', String(Math.max(1, Math.floor(params.size))))
    }
    if (params.includeSubtasks === false) {
        search.set('includeSubtasks', 'false')
    }
    const collapsed = params.collapsedParentIds?.filter((id) => id.trim().length > 0) ?? []
    for (const id of collapsed) {
        search.append('collapsedParentIds', id)
    }
    const qs = search.toString()
    const url = `${base(gameId)}${qs ? `?${qs}` : ''}`
    const res = await api.get(url)
    const raw = res.data as Partial<TaskListPage> | null
    const content = Array.isArray(raw?.content) ? (raw!.content as TaskListDisplayRow[]) : []
    return {
        content,
        totalElements: typeof raw?.totalElements === 'number' ? raw!.totalElements : 0,
        totalPages: typeof raw?.totalPages === 'number' ? raw!.totalPages : 0,
        number: typeof raw?.number === 'number' ? raw!.number : 0,
        size: typeof raw?.size === 'number' ? raw!.size : 0,
    }
}

export async function createTask(gameId: string, body: UpsertTaskBody): Promise<Task> {
    const res = await api.post(base(gameId), body)
    return res.data as Task
}

export async function updateTask(gameId: string, id: string, body: UpsertTaskBody): Promise<Task> {
    const res = await api.put(`${base(gameId)}/${encodeURIComponent(id)}`, body)
    return res.data as Task
}

export async function deleteTask(gameId: string, id: string): Promise<void> {
    await api.delete(`${base(gameId)}/${encodeURIComponent(id)}`)
}

export async function archiveTask(gameId: string, id: string): Promise<void> {
    await api.post(`${base(gameId)}/${encodeURIComponent(id)}/archive`)
}

export async function unarchiveTask(gameId: string, id: string): Promise<void> {
    await api.post(`${base(gameId)}/${encodeURIComponent(id)}/unarchive`)
}
