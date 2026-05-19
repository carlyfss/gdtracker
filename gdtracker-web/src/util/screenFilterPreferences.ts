import type { TaskStatus } from '../api/tasks'

const STORAGE_VERSION = 1

function storageKey(screen: string, gameId: string): string {
    return `gdtracker.filters.${screen}:${gameId.trim()}`
}

function readJson(key: string): unknown {
    try {
        const raw = localStorage.getItem(key)
        if (!raw) return null
        return JSON.parse(raw) as unknown
    } catch {
        return null
    }
}

function writeJson(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify(value))
    } catch {
        /* private browsing / quota */
    }
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function pickString(v: unknown): string | undefined {
    return typeof v === 'string' ? v : undefined
}

function pickStringArray(v: unknown): string[] | undefined {
    if (!Array.isArray(v)) return undefined
    return v.filter((x): x is string => typeof x === 'string' && x.length > 0)
}

function pickBool(v: unknown): boolean | undefined {
    return typeof v === 'boolean' ? v : undefined
}

function pickNumber(v: unknown): number | undefined {
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

const TASK_STATUSES: TaskStatus[] = ['PENDING', 'TODO', 'IN_PROGRESS', 'COMPLETED', 'DONE']

export type TasksFilters = {
    featureId: string
    categoryId: string
    status: TaskStatus | '__all__'
    tagIds: string[]
    tagMode: 'ANY' | 'ALL'
}

export type TasksFiltersValidators = {
    featureIds: readonly string[]
    categoryIds: readonly string[]
    tagIds: readonly string[]
}

export function readTasksFilters(gameId: string, v: TasksFiltersValidators): TasksFilters | null {
    if (!gameId.trim()) return null
    const data = readJson(storageKey('tasks', gameId))
    if (!isRecord(data) || data.v !== STORAGE_VERSION) return null

    let featureId = pickString(data.featureId) ?? '__all__'
    if (featureId !== '__all__' && !v.featureIds.includes(featureId)) featureId = '__all__'

    let categoryId = pickString(data.categoryId) ?? '__all__'
    if (categoryId !== '__all__' && !v.categoryIds.includes(categoryId)) categoryId = '__all__'

    let status: TaskStatus | '__all__' = '__all__'
    const rawStatus = pickString(data.status)
    if (rawStatus === '__all__' || (rawStatus && TASK_STATUSES.includes(rawStatus as TaskStatus))) {
        status = (rawStatus ?? '__all__') as TaskStatus | '__all__'
    }

    const rawTagIds = pickStringArray(data.tagIds) ?? []
    const tagIds = rawTagIds.filter((id) => v.tagIds.includes(id))

    const tagMode = data.tagMode === 'ALL' ? 'ALL' : 'ANY'

    if (featureId === '__all__' && categoryId === '__all__' && status === '__all__' && tagIds.length === 0) {
        return null
    }

    return { featureId, categoryId, status, tagIds, tagMode }
}

export function writeTasksFilters(gameId: string, filters: TasksFilters): void {
    if (!gameId.trim()) return
    const isDefault =
        filters.featureId === '__all__' &&
        filters.categoryId === '__all__' &&
        filters.status === '__all__' &&
        filters.tagIds.length === 0
    const key = storageKey('tasks', gameId)
    if (isDefault) {
        try {
            localStorage.removeItem(key)
        } catch {
            /* ignore */
        }
        return
    }
    writeJson(key, { v: STORAGE_VERSION, ...filters })
}

export type HeatmapFilters = {
    selectedMap: string
    heatmapEventCodeFilter: string
    rangeXMin: number
    rangeXMax: number
    rangeYMin: number
    rangeYMax: number
    playerIdInput: string
    eventCodeFilter: string
    eventsSize: number
}

export function readHeatmapFilters(gameId: string): HeatmapFilters | null {
    if (!gameId.trim()) return null
    const data = readJson(storageKey('heatmap', gameId))
    if (!isRecord(data) || data.v !== STORAGE_VERSION) return null

    const selectedMap = pickString(data.selectedMap) ?? '__all__'
    const heatmapEventCodeFilter = pickString(data.heatmapEventCodeFilter) ?? '__all__'
    const rangeXMin = pickNumber(data.rangeXMin)
    const rangeXMax = pickNumber(data.rangeXMax)
    const rangeYMin = pickNumber(data.rangeYMin)
    const rangeYMax = pickNumber(data.rangeYMax)
    const playerIdInput = pickString(data.playerIdInput) ?? ''
    const eventCodeFilter = pickString(data.eventCodeFilter) ?? '__all__'
    const eventsSize = pickNumber(data.eventsSize)

    const defaults =
        selectedMap === '__all__' &&
        heatmapEventCodeFilter === '__all__' &&
        rangeXMin == null &&
        rangeXMax == null &&
        rangeYMin == null &&
        rangeYMax == null &&
        playerIdInput === '' &&
        eventCodeFilter === '__all__' &&
        eventsSize == null

    if (defaults) return null

    return {
        selectedMap,
        heatmapEventCodeFilter,
        rangeXMin: rangeXMin ?? -100,
        rangeXMax: rangeXMax ?? 100,
        rangeYMin: rangeYMin ?? -100,
        rangeYMax: rangeYMax ?? 100,
        playerIdInput,
        eventCodeFilter,
        eventsSize: eventsSize ?? 10,
    }
}

export function writeHeatmapFilters(gameId: string, filters: HeatmapFilters): void {
    if (!gameId.trim()) return
    const isDefault =
        filters.selectedMap === '__all__' &&
        filters.heatmapEventCodeFilter === '__all__' &&
        filters.rangeXMin === -100 &&
        filters.rangeXMax === 100 &&
        filters.rangeYMin === -100 &&
        filters.rangeYMax === -100 &&
        filters.playerIdInput.trim() === '' &&
        filters.eventCodeFilter === '__all__' &&
        filters.eventsSize === 10

    const key = storageKey('heatmap', gameId)
    if (isDefault) {
        try {
            localStorage.removeItem(key)
        } catch {
            /* ignore */
        }
        return
    }
    writeJson(key, { v: STORAGE_VERSION, ...filters })
}

export type ArchiveFilters = {
    selectedFeatureId: string | null
    listShowSubfeatures: boolean
    collapsedFeatureIds: string[]
}

export function readArchiveFilters(gameId: string, featureIds: readonly string[]): ArchiveFilters | null {
    if (!gameId.trim()) return null
    const data = readJson(storageKey('archive', gameId))
    if (!isRecord(data) || data.v !== STORAGE_VERSION) return null

    let selectedFeatureId = pickString(data.selectedFeatureId) ?? null
    if (selectedFeatureId && !featureIds.includes(selectedFeatureId)) selectedFeatureId = null

    const listShowSubfeatures = pickBool(data.listShowSubfeatures) ?? true
    const rawCollapsed = pickStringArray(data.collapsedFeatureIds) ?? []
    const collapsedFeatureIds = rawCollapsed.filter((id) => featureIds.includes(id))

    if (selectedFeatureId == null && listShowSubfeatures && collapsedFeatureIds.length === 0) {
        return null
    }

    return { selectedFeatureId, listShowSubfeatures, collapsedFeatureIds }
}

export function writeArchiveFilters(gameId: string, filters: ArchiveFilters): void {
    if (!gameId.trim()) return
    const isDefault =
        filters.selectedFeatureId == null && filters.listShowSubfeatures && filters.collapsedFeatureIds.length === 0

    const key = storageKey('archive', gameId)
    if (isDefault) {
        try {
            localStorage.removeItem(key)
        } catch {
            /* ignore */
        }
        return
    }
    writeJson(key, { v: STORAGE_VERSION, ...filters })
}

export type DashboardFilters = {
    exceptionBucket: 'minute' | 'halfHour' | 'hour' | 'day'
    listShowSubfeatures: boolean
    collapsedFeatureIds: string[]
}

const TIME_BUCKETS: DashboardFilters['exceptionBucket'][] = ['minute', 'halfHour', 'hour', 'day']

export function readDashboardFilters(gameId: string, featureIds: readonly string[]): DashboardFilters | null {
    if (!gameId.trim()) return null
    const data = readJson(storageKey('dashboard', gameId))
    if (!isRecord(data) || data.v !== STORAGE_VERSION) return null

    const rawBucket = pickString(data.exceptionBucket)
    const exceptionBucket =
        rawBucket && TIME_BUCKETS.includes(rawBucket as DashboardFilters['exceptionBucket'])
            ? (rawBucket as DashboardFilters['exceptionBucket'])
            : 'minute'

    const listShowSubfeatures = pickBool(data.listShowSubfeatures) ?? true
    const rawCollapsed = pickStringArray(data.collapsedFeatureIds) ?? []
    const collapsedFeatureIds = rawCollapsed.filter((id) => featureIds.includes(id))

    if (exceptionBucket === 'minute' && listShowSubfeatures && collapsedFeatureIds.length === 0) {
        return null
    }

    return { exceptionBucket, listShowSubfeatures, collapsedFeatureIds }
}

export function writeDashboardFilters(gameId: string, filters: DashboardFilters): void {
    if (!gameId.trim()) return
    const isDefault =
        filters.exceptionBucket === 'minute' && filters.listShowSubfeatures && filters.collapsedFeatureIds.length === 0

    const key = storageKey('dashboard', gameId)
    if (isDefault) {
        try {
            localStorage.removeItem(key)
        } catch {
            /* ignore */
        }
        return
    }
    writeJson(key, { v: STORAGE_VERSION, ...filters })
}
