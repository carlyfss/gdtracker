import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { TagTasksModal } from '../components/TagTasksModal'
import { TaskDescriptionMarkdown } from '../components/TaskDescriptionMarkdown'
import { useGameId } from '../context/GameIdContext'
import type { Category } from '../api/categories'
import { listCategories } from '../api/categories'
import type { Tag } from '../api/tags'
import { listTags } from '../api/tags'
import { getConfiguration } from '../api/configuration'
import type { Feature } from '../api/features'
import { listFeatures } from '../api/features'
import type { Task, TaskStatus } from '../api/tasks'
import { createTask, deleteTask, listTasks, updateTask } from '../api/tasks'
import { chipTextColor } from '../util/chipTextColor'
import { directChildProgress, flattenTasksForList, formatChildProgressLabel, isUnderAncestor } from '../util/taskTree'

type UiState =
    | { kind: 'idle' }
    | { kind: 'loading'; message: string }
    | { kind: 'error'; message: string }
    | { kind: 'success'; message: string }

type TaskDraft = {
    title: string
    description: string
    status: TaskStatus
    featureId: string
    categoryId: string
    parentTaskId: string
    tagIds: string[]
}

type TaskModal =
    | { kind: 'closed' }
    | { kind: 'create'; draft: TaskDraft }
    | { kind: 'task'; taskId: string; surface: 'view'; draft: TaskDraft }
    | { kind: 'task'; taskId: string; surface: 'edit'; draft: TaskDraft; editBaseline: TaskDraft }

function normalizeTitle(raw: string) {
    return raw.trim().replace(/\s+/g, ' ')
}

const allStatus: TaskStatus[] = ['PENDING', 'TODO', 'IN_PROGRESS', 'COMPLETED', 'DONE']

const FALLBACK_FEATURE_COLOR = '#94a3b8'

function statusLabel(s: TaskStatus) {
    switch (s) {
        case 'PENDING':
            return 'Pending'
        case 'TODO':
            return 'Todo'
        case 'IN_PROGRESS':
            return 'In Progress'
        case 'COMPLETED':
            return 'Completed'
        case 'DONE':
            return 'Done'
        default:
            return s
    }
}

function featureMeta(t: Task, features: Feature[]) {
    const f = t.feature ?? (t.featureId ? features.find((x) => x.id === t.featureId) : undefined)
    const color = f?.color && /^#[0-9A-Fa-f]{6}$/i.test(f.color) ? f.color.toLowerCase() : FALLBACK_FEATURE_COLOR
    return { name: f?.name ?? '', color }
}

function categoryMeta(t: Task, categories: Category[]) {
    const c = t.category ?? (t.categoryId ? categories.find((x) => x.id === t.categoryId) : undefined)
    const color = c?.color && /^#[0-9A-Fa-f]{6}$/i.test(c.color) ? c.color.toLowerCase() : FALLBACK_FEATURE_COLOR
    return { name: c?.name ?? '', color }
}

function sortedTaskTags(t: Task): Tag[] {
    const raw = t.tags
    if (!Array.isArray(raw) || raw.length === 0) return []
    return [...raw].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
}

function nextTaskStatus(s: TaskStatus): TaskStatus | null {
    const i = allStatus.indexOf(s)
    if (i < 0 || i >= allStatus.length - 1) return null
    return allStatus[i + 1]!
}

function tagIdsFromTask(t: Task): string[] {
    const fromTags = t.tags?.map((x) => x.id).filter(Boolean)
    if (fromTags && fromTags.length > 0) return fromTags
    const raw = t.tagIds
    if (Array.isArray(raw)) {
        return raw.filter((id): id is string => typeof id === 'string' && id.length > 0)
    }
    return []
}

function draftFromTask(t: Task): TaskDraft {
    const pid = t.parentTaskId
    return {
        title: t.title ?? '',
        description: typeof t.description === 'string' ? t.description : '',
        status: (t.status ?? 'TODO') as TaskStatus,
        featureId: String(t.feature?.id ?? t.featureId ?? ''),
        categoryId: String(t.category?.id ?? t.categoryId ?? ''),
        parentTaskId: typeof pid === 'string' && pid.length > 0 ? pid : '',
        tagIds: tagIdsFromTask(t),
    }
}

function emptyDraft(featureId: string, categoryId: string): TaskDraft {
    return { title: '', description: '', status: 'TODO', featureId, categoryId, parentTaskId: '', tagIds: [] }
}

function upsertBodyParentId(d: TaskDraft): string | null {
    const p = d.parentTaskId.trim()
    return p.length > 0 ? p : null
}

function parentTaskPickerOptions(tasks: Task[], draftFeatureId: string, editingTaskId: string | null): Task[] {
    return tasks
        .filter((t) => {
            const tf = String(t.feature?.id ?? t.featureId ?? '')
            if (tf !== draftFeatureId) return false
            if (editingTaskId && t.id === editingTaskId) return false
            if (editingTaskId && isUnderAncestor(editingTaskId, t.id, tasks)) return false
            return true
        })
        .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
}

function IconTrash() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
    )
}

function IconClose() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" />
        </svg>
    )
}

function IconCheck() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function IconChevronTaskTree({ expanded }: { expanded: boolean }) {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            style={{
                transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                flexShrink: 0,
                transition: 'transform 0.12s ease-out',
            }}
        >
            <polyline points="9 18 15 12 9 6" />
        </svg>
    )
}

export function TasksPage() {
    const gameId = useGameId()
    const [searchParams, setSearchParams] = useSearchParams()

    const [features, setFeatures] = useState<Feature[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [allTags, setAllTags] = useState<Tag[]>([])
    const [gameDefaultCategoryId, setGameDefaultCategoryId] = useState<string | null>(null)
    const [tasks, setTasks] = useState<Task[]>([])
    const [state, setState] = useState<UiState>({ kind: 'idle' })

    const [selectedFeatureId, setSelectedFeatureId] = useState<string>(() => searchParams.get('feature') ?? '__all__')
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('__all__')
    const [selectedFilterTagIds, setSelectedFilterTagIds] = useState<string[]>([])
    const [tagFilterMode, setTagFilterMode] = useState<'ANY' | 'ALL'>('ANY')
    const [selectedStatus, setSelectedStatus] = useState<TaskStatus | '__all__'>('__all__')
    const [advancingTaskId, setAdvancingTaskId] = useState<string | null>(null)
    const [listShowSubtasks, setListShowSubtasks] = useState(true)
    const [collapsedTaskIds, setCollapsedTaskIds] = useState<Set<string>>(() => new Set())

    const [modal, setModal] = useState<TaskModal>({ kind: 'closed' })
    const [tagBrowseModalTag, setTagBrowseModalTag] = useState<Tag | null>(null)

    const skipFilterRefreshOnce = useRef(true)

    const modalOpen = modal.kind !== 'closed'

    const listRows = useMemo(
        () =>
            flattenTasksForList(tasks, {
                showSubtasks: listShowSubtasks,
                collapsedParentIds: collapsedTaskIds,
            }),
        [tasks, listShowSubtasks, collapsedTaskIds]
    )

    const toggleTaskRowCollapsed = (taskId: string) => {
        setCollapsedTaskIds((prev) => {
            const next = new Set(prev)
            if (next.has(taskId)) next.delete(taskId)
            else next.add(taskId)
            return next
        })
    }

    const refreshFeatures = async () => {
        try {
            const data = await listFeatures(gameId)
            setFeatures(data)
            return data
        } catch {
            setFeatures([])
            throw new Error('features')
        }
    }

    const refreshTasks = async (opts?: {
        featuresSnapshot?: Feature[]
        categoriesSnapshot?: Category[]
        tagsSnapshot?: Tag[]
    }) => {
        const featureId = selectedFeatureId !== '__all__' ? selectedFeatureId : undefined
        const categoryId = selectedCategoryId !== '__all__' ? selectedCategoryId : undefined
        const status = selectedStatus !== '__all__' ? selectedStatus : undefined
        const tagIds = selectedFilterTagIds.length > 0 ? selectedFilterTagIds : undefined
        try {
            const data = await listTasks(gameId, {
                featureId,
                status,
                categoryId,
                ...(tagIds
                    ? {
                          tagIds,
                          ...(tagIds.length >= 2 ? { tagMode: tagFilterMode } : {}),
                      }
                    : {}),
            })
            const featureMap = new Map((opts?.featuresSnapshot ?? features).map((f) => [f.id, f]))
            const categoryMap = new Map((opts?.categoriesSnapshot ?? categories).map((c) => [c.id, c]))
            const tagMap = new Map((opts?.tagsSnapshot ?? allTags).map((x) => [x.id, x]))
            setTasks(
                data.map((t) => {
                    let out: Task = { ...t }
                    const fid = (t.feature?.id ?? t.featureId ?? null) as string | null
                    if (fid && !t.feature) {
                        const f = featureMap.get(fid)
                        if (f) out = { ...out, feature: f }
                    }
                    const cid = (t.category?.id ?? t.categoryId ?? null) as string | null
                    if (cid && !t.category) {
                        const cat = categoryMap.get(cid)
                        if (cat) out = { ...out, category: cat }
                    }
                    const rawTags = t.tags
                    if (Array.isArray(rawTags) && rawTags.length > 0) {
                        out = {
                            ...out,
                            tags: rawTags.map((tg) => {
                                const full = tagMap.get(tg.id)
                                return full ?? tg
                            }),
                        }
                    }
                    return out
                })
            )
        } catch {
            setTasks([])
            throw new Error('tasks')
        }
    }

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void (async () => {
                setState({ kind: 'loading', message: 'Loading…' })
                try {
                    const f = await refreshFeatures()
                    const cats = await listCategories(gameId)
                    setCategories(cats)
                    let tagsSnap: Tag[] = []
                    try {
                        tagsSnap = await listTags(gameId)
                        setAllTags(tagsSnap)
                    } catch {
                        setAllTags([])
                    }
                    try {
                        const cfg = await getConfiguration(gameId)
                        setGameDefaultCategoryId(cfg.defaultExceptionTaskCategoryId ?? null)
                    } catch {
                        setGameDefaultCategoryId(null)
                    }
                    await refreshTasks({ featuresSnapshot: f, categoriesSnapshot: cats, tagsSnapshot: tagsSnap })
                    setState({ kind: 'idle' })
                } catch {
                    setState({ kind: 'error', message: 'Failed to load tasks.' })
                }
            })()
        }, 0)
        return () => window.clearTimeout(timer)
        // refreshFeatures / refreshTasks close over gameId and filter state; include gameId only to avoid redundant loads.
        // eslint-disable-next-line react-hooks/exhaustive-deps -- mount and gameId change
    }, [gameId])

    useEffect(() => {
        const id = window.setTimeout(() => {
            const f = searchParams.get('feature')
            if (f) setSelectedFeatureId(f)
            const t = searchParams.get('task')
            if (f || t) {
                setSelectedCategoryId('__all__')
                setSelectedStatus('__all__')
            }
        }, 0)
        return () => window.clearTimeout(id)
    }, [searchParams])

    useEffect(() => {
        const tid = searchParams.get('task')
        if (!tid) return

        const clearTaskQuery = () => {
            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev)
                    next.delete('feature')
                    next.delete('task')
                    return next
                },
                { replace: true }
            )
        }

        const openFromTask = (t: Task) => {
            setModal({ kind: 'task', taskId: t.id, surface: 'view', draft: draftFromTask(t) })
            clearTaskQuery()
        }

        const inList = tasks.find((x) => x.id === tid)
        if (inList) {
            const id = window.setTimeout(() => openFromTask(inList), 0)
            return () => window.clearTimeout(id)
        }

        let cancelled = false
        void (async () => {
            try {
                const all = await listTasks(gameId, {})
                if (cancelled) return
                const t = all.find((x) => x.id === tid)
                if (t) openFromTask(t)
            } catch {
                /* ignore */
            }
        })()
        return () => {
            cancelled = true
        }
    }, [tasks, searchParams, setSearchParams, gameId])

    useEffect(() => {
        if (skipFilterRefreshOnce.current) {
            skipFilterRefreshOnce.current = false
            return
        }
        void (async () => {
            try {
                await refreshTasks()
            } catch {
                setState({ kind: 'error', message: 'Failed to load tasks.' })
            }
        })()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedFeatureId, selectedCategoryId, selectedFilterTagIds, tagFilterMode, selectedStatus, gameId])

    useEffect(() => {
        if (!modalOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setModal({ kind: 'closed' })
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [modalOpen])

    const defaultFeatureIdForCreate = useMemo(() => {
        if (features.length === 0) return ''
        if (selectedFeatureId !== '__all__' && features.some((f) => f.id === selectedFeatureId)) {
            return selectedFeatureId
        }
        return features[0]!.id
    }, [features, selectedFeatureId])

    const defaultCategoryIdForCreate = useMemo(() => {
        if (categories.length === 0) return ''
        if (gameDefaultCategoryId && categories.some((c) => c.id === gameDefaultCategoryId)) {
            return gameDefaultCategoryId
        }
        return categories[0]!.id
    }, [categories, gameDefaultCategoryId])

    const canSubmitDraft = (d: TaskDraft) => normalizeTitle(d.title).length > 0 && d.featureId.length > 0

    const openCreateModal = () => {
        if (features.length === 0) return
        setModal({
            kind: 'create',
            draft: emptyDraft(defaultFeatureIdForCreate, defaultCategoryIdForCreate),
        })
    }

    const openTaskView = (t: Task) => {
        setModal({ kind: 'task', taskId: t.id, surface: 'view', draft: draftFromTask(t) })
    }

    const closeModal = () => setModal({ kind: 'closed' })

    const patchDraft = (patch: Partial<TaskDraft>) => {
        setModal((prev) => {
            if (prev.kind === 'closed') return prev
            if (prev.kind === 'create') return { ...prev, draft: { ...prev.draft, ...patch } }
            if (prev.kind === 'task' && prev.surface === 'edit') {
                return { ...prev, draft: { ...prev.draft, ...patch } }
            }
            if (prev.kind === 'task' && prev.surface === 'view') {
                return { ...prev, draft: { ...prev.draft, ...patch } }
            }
            return prev
        })
    }

    const toggleDraftTagId = (tagId: string) => {
        setModal((prev) => {
            const apply = (d: TaskDraft): TaskDraft => {
                const has = d.tagIds.includes(tagId)
                return {
                    ...d,
                    tagIds: has ? d.tagIds.filter((id) => id !== tagId) : [...d.tagIds, tagId],
                }
            }
            if (prev.kind === 'create') return { ...prev, draft: apply(prev.draft) }
            if (prev.kind === 'task' && prev.surface === 'edit') return { ...prev, draft: apply(prev.draft) }
            return prev
        })
    }

    const toggleFilterTagId = (tagId: string) => {
        setSelectedFilterTagIds((p) => (p.includes(tagId) ? p.filter((id) => id !== tagId) : [...p, tagId]))
    }

    const toggleTaskSurface = () => {
        setModal((prev) => {
            if (prev.kind !== 'task') return prev
            if (prev.surface === 'view') {
                const baseline = { ...prev.draft }
                return {
                    kind: 'task',
                    taskId: prev.taskId,
                    surface: 'edit',
                    draft: { ...prev.draft },
                    editBaseline: baseline,
                }
            }
            return { kind: 'task', taskId: prev.taskId, surface: 'view', draft: { ...prev.draft } }
        })
    }

    const onCreate = async () => {
        if (modal.kind !== 'create') return
        const title = normalizeTitle(modal.draft.title)
        if (!title || !modal.draft.featureId) return
        setState({ kind: 'loading', message: 'Creating task…' })
        try {
            await createTask(gameId, {
                title,
                description: modal.draft.description.trim().length ? modal.draft.description : null,
                status: modal.draft.status,
                featureId: modal.draft.featureId,
                categoryId: modal.draft.categoryId.trim().length > 0 ? modal.draft.categoryId.trim() : null,
                tagIds: modal.draft.tagIds,
                parentTaskId: upsertBodyParentId(modal.draft),
            })
            closeModal()
            await refreshTasks()
            setState({ kind: 'success', message: 'Task created.' })
        } catch {
            setState({ kind: 'error', message: 'Failed to create task.' })
        }
    }

    const onSaveTask = async () => {
        if (modal.kind !== 'task' || modal.surface !== 'edit') return
        const title = normalizeTitle(modal.draft.title)
        if (!title || !modal.draft.featureId) return
        setState({ kind: 'loading', message: 'Saving…' })
        try {
            const updated = await updateTask(gameId, modal.taskId, {
                title,
                description: modal.draft.description.trim().length ? modal.draft.description : null,
                status: modal.draft.status,
                featureId: modal.draft.featureId,
                categoryId: modal.draft.categoryId.trim().length > 0 ? modal.draft.categoryId.trim() : null,
                tagIds: modal.draft.tagIds,
                parentTaskId: upsertBodyParentId(modal.draft),
            })
            setModal({
                kind: 'task',
                taskId: updated.id,
                surface: 'view',
                draft: draftFromTask(updated),
            })
            await refreshTasks()
            setState({ kind: 'success', message: 'Task updated.' })
        } catch {
            setState({ kind: 'error', message: 'Failed to update task.' })
        }
    }

    const cancelEditToView = () => {
        setModal((prev) => {
            if (prev.kind !== 'task' || prev.surface !== 'edit') return prev
            return {
                kind: 'task',
                taskId: prev.taskId,
                surface: 'view',
                draft: { ...prev.editBaseline },
            }
        })
    }

    const onDelete = async (t: Task) => {
        const ok = window.confirm(`Delete task "${t.title}"?`)
        if (!ok) return

        setState({ kind: 'loading', message: 'Deleting…' })
        try {
            await deleteTask(gameId, t.id)
            if (modal.kind === 'task' && modal.taskId === t.id) {
                closeModal()
            }
            await refreshTasks()
            setState({ kind: 'success', message: 'Task deleted.' })
        } catch {
            setState({ kind: 'error', message: 'Failed to delete task.' })
        }
    }

    const featureNameById = (id: string) => features.find((f) => f.id === id)?.name ?? ''
    const categoryNameById = (id: string) => categories.find((c) => c.id === id)?.name ?? ''

    const onAdvanceStatus = async (t: Task) => {
        const next = nextTaskStatus(t.status as TaskStatus)
        if (!next) return
        const featureId = String(t.feature?.id ?? t.featureId ?? '')
        if (!featureId) return
        setAdvancingTaskId(t.id)
        setState({ kind: 'idle' })
        try {
            const categoryId = (t.category?.id ?? t.categoryId ?? '').trim()
            const pid = t.parentTaskId
            await updateTask(gameId, t.id, {
                title: t.title,
                description: typeof t.description === 'string' ? t.description : null,
                status: next,
                featureId,
                categoryId: categoryId.length > 0 ? categoryId : null,
                tagIds: tagIdsFromTask(t),
                parentTaskId: typeof pid === 'string' && pid.length > 0 ? pid : null,
            })
            await refreshTasks()
        } catch {
            setState({ kind: 'error', message: 'Failed to advance status.' })
        } finally {
            setAdvancingTaskId(null)
        }
    }

    const modalTitleText = useMemo(() => {
        if (modal.kind === 'create') return 'Create task'
        if (modal.kind === 'task') return modal.surface === 'view' ? 'View task' : 'Edit task'
        return ''
    }, [modal])

    const filteredCountLabel = useMemo(() => {
        const parts: string[] = []
        if (selectedFeatureId !== '__all__') {
            const f = features.find((x) => x.id === selectedFeatureId)
            if (f) parts.push(`Feature: ${f.name}`)
        }
        if (selectedCategoryId !== '__all__') {
            const c = categories.find((x) => x.id === selectedCategoryId)
            if (c) parts.push(`Category: ${c.name}`)
        }
        if (selectedStatus !== '__all__') parts.push(`Status: ${statusLabel(selectedStatus)}`)
        if (selectedFilterTagIds.length > 0) {
            const labels = selectedFilterTagIds
                .map((id) => allTags.find((x) => x.id === id)?.name ?? id)
                .join(', ')
            parts.push(
                `Tags (${tagFilterMode}): ${labels}`
            )
        }
        return parts.length ? parts.join(' • ') : 'All tasks'
    }, [
        allTags,
        categories,
        features,
        selectedCategoryId,
        selectedFeatureId,
        selectedFilterTagIds,
        tagFilterMode,
        selectedStatus,
    ])

    return (
        <section className="gamePageSection">
            <div className="cardHeader">
                <h2 className="cardTitle">Tasks</h2>
                <div className="cardHeaderMetaRow">
                    <span className="muted" style={{ fontSize: 13 }}>
                        {filteredCountLabel}
                    </span>
                    <span className="muted" style={{ fontSize: 13 }} aria-live="polite">
                        {tasks.length} shown
                    </span>
                </div>
            </div>

            <div className="cardBody tasksLayout">
                <aside className="tasksFilterPanel" aria-label="Task filters">
                    <div className="tasksFilterPanelTitle">Filter by feature</div>
                    {features.length === 0 && (
                        <div className="emptyState">
                            No features yet. Create one on the{' '}
                            <Link to={`/g/${encodeURIComponent(gameId)}/configuration`}>Configuration</Link> page.
                        </div>
                    )}

                    {features.length > 0 && (
                        <div className="tasksFilterList" role="list">
                            <button
                                type="button"
                                className="filterItem"
                                data-active={selectedFeatureId === '__all__'}
                                onClick={() => setSelectedFeatureId('__all__')}
                            >
                                <span className="filterItemInner">
                                    <span
                                        className="featureSwatch"
                                        style={{ backgroundColor: FALLBACK_FEATURE_COLOR }}
                                    />
                                    <span>All features</span>
                                </span>
                            </button>
                            {features.map((f) => {
                                const c =
                                    f.color && /^#[0-9A-Fa-f]{6}$/i.test(f.color)
                                        ? f.color.toLowerCase()
                                        : FALLBACK_FEATURE_COLOR
                                return (
                                    <button
                                        key={f.id}
                                        type="button"
                                        className="filterItem"
                                        data-active={selectedFeatureId === f.id}
                                        onClick={() => setSelectedFeatureId(f.id)}
                                    >
                                        <span className="filterItemInner">
                                            <span className="featureSwatch" style={{ backgroundColor: c }} />
                                            <span>{f.name}</span>
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    <div className="tasksFilterPanelTitle" style={{ marginTop: 14 }}>
                        Filter by category
                    </div>
                    {categories.length === 0 && (
                        <div className="emptyState">
                            No categories yet. Create one on the{' '}
                            <Link to={`/g/${encodeURIComponent(gameId)}/configuration`}>Configuration</Link> page.
                        </div>
                    )}
                    {categories.length > 0 && (
                        <div className="tasksFilterList" role="list">
                            <button
                                type="button"
                                className="filterItem"
                                data-active={selectedCategoryId === '__all__'}
                                onClick={() => setSelectedCategoryId('__all__')}
                            >
                                <span className="filterItemInner">
                                    <span
                                        className="featureSwatch"
                                        style={{ backgroundColor: FALLBACK_FEATURE_COLOR }}
                                    />
                                    <span>All categories</span>
                                </span>
                            </button>
                            {categories.map((cat) => {
                                const col =
                                    cat.color && /^#[0-9A-Fa-f]{6}$/i.test(cat.color)
                                        ? cat.color.toLowerCase()
                                        : FALLBACK_FEATURE_COLOR
                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        className="filterItem"
                                        data-active={selectedCategoryId === cat.id}
                                        onClick={() => setSelectedCategoryId(cat.id)}
                                    >
                                        <span className="filterItemInner">
                                            <span className="featureSwatch" style={{ backgroundColor: col }} />
                                            <span>{cat.name}</span>
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    <div className="tasksFilterPanelTitle" style={{ marginTop: 14 }}>
                        Status
                    </div>
                    <select
                        className="intervalSelect"
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value as TaskStatus | '__all__')}
                        aria-label="Filter tasks by status"
                    >
                        <option value="__all__">All statuses</option>
                        {allStatus.map((s) => (
                            <option key={s} value={s}>
                                {statusLabel(s)}
                            </option>
                        ))}
                    </select>

                    <div className="tasksFilterPanelTitle" style={{ marginTop: 14 }}>
                        Filter by tag
                    </div>
                    {allTags.length === 0 && (
                        <div className="emptyState" style={{ fontSize: 13 }}>
                            No tags yet. Create tags on the{' '}
                            <Link to={`/g/${encodeURIComponent(gameId)}/configuration`}>Configuration</Link> page.
                        </div>
                    )}
                    {allTags.length >= 2 && selectedFilterTagIds.length >= 2 && (
                        <div style={{ marginBottom: 8 }}>
                            <label className="tasksFilterPanelTitle" style={{ marginBottom: 4, display: 'block' }}>
                                Match
                            </label>
                            <select
                                className="intervalSelect"
                                value={tagFilterMode}
                                onChange={(e) => setTagFilterMode(e.target.value as 'ANY' | 'ALL')}
                                aria-label="Match any or all selected tags"
                            >
                                <option value="ANY">Any selected tag</option>
                                <option value="ALL">All selected tags</option>
                            </select>
                        </div>
                    )}
                    {allTags.length > 0 && (
                        <div className="tasksTagFilterChips" role="group" aria-label="Filter by tags">
                            {allTags.map((tg) => {
                                const col =
                                    tg.color && /^#[0-9A-Fa-f]{6}$/i.test(tg.color)
                                        ? tg.color.toLowerCase()
                                        : FALLBACK_FEATURE_COLOR
                                const selected = selectedFilterTagIds.includes(tg.id)
                                return (
                                    <button
                                        key={tg.id}
                                        type="button"
                                        className="tagChip tagChipToggle"
                                        data-selected={selected}
                                        style={{
                                            backgroundColor: selected ? col : 'transparent',
                                            color: selected ? chipTextColor(col) : col,
                                            borderColor: col,
                                        }}
                                        onClick={() => toggleFilterTagId(tg.id)}
                                    >
                                        #{tg.name}
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    <div className="tasksFilterPanelFooter">
                        <button
                            type="button"
                            className="btn btnPrimary"
                            disabled={features.length === 0 || state.kind === 'loading'}
                            onClick={openCreateModal}
                        >
                            New task
                        </button>
                    </div>
                </aside>

                <div className="tasksContent">
                    {state.kind === 'error' && <div className="banner bannerError">{state.message}</div>}
                    {state.kind === 'success' && <div className="banner bannerSuccess">{state.message}</div>}
                    {state.kind === 'loading' && <div className="banner">{state.message}</div>}

                    {tasks.length === 0 && state.kind !== 'loading' && (
                        <div className="emptyState">No tasks match your filters.</div>
                    )}

                    {tasks.length > 0 && (
                        <div className="tableWrap tasksTableWrap">
                            <div className="tasksListToolbar">
                                <label htmlFor="tasks-subtasks-visibility" className="tasksListToolbarLabel">
                                    Subtasks
                                </label>
                                <select
                                    id="tasks-subtasks-visibility"
                                    className="intervalSelect tasksListToolbarSelect"
                                    value={listShowSubtasks ? 'show' : 'hide'}
                                    onChange={(e) => setListShowSubtasks(e.target.value === 'show')}
                                    aria-label="Show or hide subtasks in the list"
                                >
                                    <option value="show">Show subtasks</option>
                                    <option value="hide">Hide subtasks</option>
                                </select>
                            </div>
                            <table className="table tableCompact tableTasksList">
                                <thead>
                                    <tr>
                                        <th className="tasksListTitleCol">Title</th>
                                        <th className="tasksListProgressCol">Progress</th>
                                        <th className="tasksListStatusCol">Status</th>
                                        <th className="tasksListFeatureCol">Feature</th>
                                        <th className="tasksListCategoryCol">Category</th>
                                        <th className="tasksListTagCol">Tag</th>
                                        <th className="tasksListActionsCol" aria-label="Actions" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {listRows.map((row, idx) => {
                                        const t = row.task
                                        const { name: fn, color: fc } = featureMeta(t, features)
                                        const { name: cn, color: cc } = categoryMeta(t, categories)
                                        const atDone = (t.status as TaskStatus) === 'DONE'
                                        const busyRow = advancingTaskId === t.id
                                        const { done: progDone, total: progTotal } = directChildProgress(t.id, tasks)
                                        const progLabels = formatChildProgressLabel(progDone, progTotal)
                                        const showFeatureCategory = row.depth === 0
                                        const rowTags = sortedTaskTags(t)
                                        const rowExpanded = row.hasChildren && !collapsedTaskIds.has(t.id)
                                        return (
                                            <tr
                                                key={t.id}
                                                className="tasksListRow"
                                                data-odd={idx % 2 === 1}
                                                role="button"
                                                tabIndex={0}
                                                aria-label={`View task: ${t.title}`}
                                                onClick={() => openTaskView(t)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault()
                                                        openTaskView(t)
                                                    }
                                                }}
                                            >
                                                <td
                                                    style={{
                                                        paddingLeft: 10 + row.depth * 14,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 4,
                                                            minWidth: 0,
                                                        }}
                                                    >
                                                        {row.hasChildren && listShowSubtasks ? (
                                                            <button
                                                                type="button"
                                                                className="iconBtn tasksTaskTreeToggle"
                                                                title={rowExpanded ? 'Hide subtasks' : 'Show subtasks'}
                                                                aria-expanded={rowExpanded}
                                                                aria-label={
                                                                    rowExpanded
                                                                        ? `Collapse subtasks for ${t.title}`
                                                                        : `Expand subtasks for ${t.title}`
                                                                }
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    toggleTaskRowCollapsed(t.id)
                                                                }}
                                                            >
                                                                <IconChevronTaskTree expanded={rowExpanded} />
                                                            </button>
                                                        ) : (
                                                            <span className="tasksTaskTreeSpacer" aria-hidden />
                                                        )}
                                                        <span style={{ minWidth: 0 }}>{t.title}</span>
                                                    </span>
                                                </td>
                                                <td className="tasksListProgressCol">
                                                    {progTotal > 0 ? (
                                                        <span title="Subtasks done / total (status DONE)">
                                                            <span className="tasksProgressPct">{progLabels.pct}</span>{' '}
                                                            <span className="muted">{progLabels.ratio}</span>
                                                        </span>
                                                    ) : null}
                                                </td>
                                                <td className="tasksListStatusCol">
                                                    <span
                                                        className="tasksStatusPill"
                                                        data-status={(t.status as TaskStatus) ?? 'TODO'}
                                                    >
                                                        {statusLabel(t.status as TaskStatus)}
                                                    </span>
                                                </td>
                                                <td>
                                                    {showFeatureCategory ? (
                                                        <span className="filterItemInner">
                                                            <span
                                                                className="featureSwatch"
                                                                style={{ backgroundColor: fc }}
                                                            />
                                                            <span style={{ color: fc }}>{fn}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="muted">—</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {showFeatureCategory ? (
                                                        cn ? (
                                                            <span className="filterItemInner">
                                                                <span
                                                                    className="featureSwatch"
                                                                    style={{ backgroundColor: cc }}
                                                                />
                                                                <span style={{ color: cc }}>{cn}</span>
                                                            </span>
                                                        ) : (
                                                            <span className="muted">—</span>
                                                        )
                                                    ) : (
                                                        <span className="muted">—</span>
                                                    )}
                                                </td>
                                                <td className="tasksListTagCol">
                                                    {rowTags.length > 0 ? (
                                                        <div className="tasksTagCell">
                                                            {rowTags.map((tg) => {
                                                                const tc =
                                                                    tg.color && /^#[0-9A-Fa-f]{6}$/i.test(tg.color)
                                                                        ? tg.color.toLowerCase()
                                                                        : FALLBACK_FEATURE_COLOR
                                                                return (
                                                                    <button
                                                                        key={tg.id}
                                                                        type="button"
                                                                        className="tagChip tagChipInteractive"
                                                                        style={{
                                                                            backgroundColor: tc,
                                                                            color: chipTextColor(tc),
                                                                        }}
                                                                        title={`#${tg.name}`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            setTagBrowseModalTag(tg)
                                                                        }}
                                                                    >
                                                                        #{tg.name}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <span className="muted">—</span>
                                                    )}
                                                </td>
                                                <td onClick={(e) => e.stopPropagation()}>
                                                    <div className="iconBtnRow" style={{ justifyContent: 'flex-end' }}>
                                                        <button
                                                            type="button"
                                                            className="iconBtn"
                                                            title={atDone ? 'Task is done' : 'Advance to next status'}
                                                            aria-label="Advance to next status"
                                                            disabled={atDone || busyRow || state.kind === 'loading'}
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                void onAdvanceStatus(t)
                                                            }}
                                                        >
                                                            <IconCheck />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="iconBtn iconBtnDanger"
                                                            title="Delete task"
                                                            aria-label="Delete task"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                void onDelete(t)
                                                            }}
                                                        >
                                                            <IconTrash />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {modalOpen &&
                createPortal(
                    <div className="modalBackdrop" onClick={closeModal} role="presentation">
                        <div
                            className="modalCard modalCardTask"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="task-modal-title"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modalTaskHeader">
                                <h3 className="modalTitle" id="task-modal-title">
                                    {modalTitleText}
                                </h3>
                                <div className="modalHeaderTrailing">
                                    {modal.kind === 'task' && (
                                        <button type="button" className="btn" onClick={toggleTaskSurface}>
                                            {modal.surface === 'view' ? 'Edit' : 'View'}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="modalCloseBtn"
                                        onClick={closeModal}
                                        title="Close"
                                        aria-label="Close dialog"
                                    >
                                        <IconClose />
                                    </button>
                                </div>
                            </div>

                            {modal.kind === 'create' && (
                                <>
                                    <div className="modalTaskScroll">
                                        <div className="modalFormGrid">
                                            <label className="modalFieldLabel" htmlFor="task-modal-title-input">
                                                Title
                                            </label>
                                            <input
                                                id="task-modal-title-input"
                                                className="textInput"
                                                value={modal.draft.title}
                                                placeholder="Title"
                                                onChange={(e) => patchDraft({ title: e.target.value })}
                                            />
                                            <div className="modalMetaRow">
                                                <div className="modalMetaCell">
                                                    <label className="modalFieldLabel" htmlFor="task-modal-feature">
                                                        Feature
                                                    </label>
                                                    <select
                                                        id="task-modal-feature"
                                                        className="intervalSelect"
                                                        value={modal.draft.featureId}
                                                        onChange={(e) =>
                                                            patchDraft({
                                                                featureId: e.target.value,
                                                                parentTaskId: '',
                                                            })
                                                        }
                                                        disabled={features.length === 0}
                                                    >
                                                        {features.map((f) => (
                                                            <option key={f.id} value={f.id}>
                                                                {f.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="modalMetaCell">
                                                    <label className="modalFieldLabel" htmlFor="task-modal-category">
                                                        Category
                                                    </label>
                                                    <select
                                                        id="task-modal-category"
                                                        className="intervalSelect"
                                                        value={modal.draft.categoryId}
                                                        onChange={(e) => patchDraft({ categoryId: e.target.value })}
                                                    >
                                                        <option value="">None</option>
                                                        {categories.map((c) => (
                                                            <option key={c.id} value={c.id}>
                                                                {c.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="modalMetaCell">
                                                    <label className="modalFieldLabel" htmlFor="task-modal-status">
                                                        Status
                                                    </label>
                                                    <select
                                                        id="task-modal-status"
                                                        className="intervalSelect"
                                                        value={modal.draft.status}
                                                        onChange={(e) =>
                                                            patchDraft({ status: e.target.value as TaskStatus })
                                                        }
                                                    >
                                                        {allStatus.map((s) => (
                                                            <option key={s} value={s}>
                                                                {statusLabel(s)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <label className="modalFieldLabel" htmlFor="task-modal-parent">
                                                Parent task (optional)
                                            </label>
                                            <select
                                                id="task-modal-parent"
                                                className="intervalSelect"
                                                value={modal.draft.parentTaskId}
                                                onChange={(e) => patchDraft({ parentTaskId: e.target.value })}
                                                aria-label="Parent task"
                                            >
                                                <option value="">None (root task)</option>
                                                {parentTaskPickerOptions(tasks, modal.draft.featureId, null).map(
                                                    (pt) => (
                                                        <option key={pt.id} value={pt.id}>
                                                            {pt.title}
                                                        </option>
                                                    )
                                                )}
                                            </select>
                                            <label className="modalFieldLabel" htmlFor="task-modal-desc">
                                                Description (markdown)
                                            </label>
                                            <textarea
                                                id="task-modal-desc"
                                                className="textArea modalTaskDescArea"
                                                value={modal.draft.description}
                                                placeholder="Description (optional, markdown)"
                                                onChange={(e) => patchDraft({ description: e.target.value })}
                                                rows={4}
                                            />
                                            <span className="modalFieldLabel">Tags</span>
                                            <div className="modalTagPicker" role="group" aria-label="Task tags">
                                                {allTags.length === 0 ? (
                                                    <span className="muted" style={{ fontSize: 13 }}>
                                                        No tags defined — add some in Configuration.
                                                    </span>
                                                ) : (
                                                    allTags.map((tg) => {
                                                        const col =
                                                            tg.color && /^#[0-9A-Fa-f]{6}$/i.test(tg.color)
                                                                ? tg.color.toLowerCase()
                                                                : FALLBACK_FEATURE_COLOR
                                                        const on = modal.draft.tagIds.includes(tg.id)
                                                        return (
                                                            <button
                                                                key={tg.id}
                                                                type="button"
                                                                className="tagChip tagChipToggle"
                                                                data-selected={on}
                                                                style={{
                                                                    backgroundColor: on ? col : 'transparent',
                                                                    color: on ? chipTextColor(col) : col,
                                                                    borderColor: col,
                                                                }}
                                                                onClick={() => toggleDraftTagId(tg.id)}
                                                            >
                                                                #{tg.name}
                                                            </button>
                                                        )
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="modalFooter">
                                        <button type="button" className="btn btnDanger" onClick={closeModal}>
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btnPrimary"
                                            disabled={!canSubmitDraft(modal.draft) || state.kind === 'loading'}
                                            onClick={() => void onCreate()}
                                        >
                                            Create
                                        </button>
                                    </div>
                                </>
                            )}

                            {modal.kind === 'task' && modal.surface === 'view' && (
                                <>
                                    <div className="modalTaskScroll">
                                        <div className="modalTaskViewBody">
                                            <div className="modalReadonlyRow">
                                                <span className="modalFieldLabel">Title</span>
                                                <div className="modalReadonlyValue">{modal.draft.title || '—'}</div>
                                            </div>
                                            <div className="modalReadonlyRow">
                                                <span className="modalFieldLabel">Parent task</span>
                                                <div className="modalReadonlyValue">
                                                    {modal.draft.parentTaskId.trim().length > 0
                                                        ? (tasks.find((x) => x.id === modal.draft.parentTaskId)
                                                              ?.title ?? modal.draft.parentTaskId)
                                                        : '—'}
                                                </div>
                                            </div>
                                            <div className="modalMetaRow modalMetaRowReadonly">
                                                <div className="modalMetaCell">
                                                    <span className="modalFieldLabel">Feature</span>
                                                    <div className="modalReadonlyValue">
                                                        {featureNameById(modal.draft.featureId) || '—'}
                                                    </div>
                                                </div>
                                                <div className="modalMetaCell">
                                                    <span className="modalFieldLabel">Category</span>
                                                    <div className="modalReadonlyValue">
                                                        {categoryNameById(modal.draft.categoryId) || '—'}
                                                    </div>
                                                </div>
                                                <div className="modalMetaCell">
                                                    <span className="modalFieldLabel">Status</span>
                                                    <div className="modalReadonlyValue">
                                                        {statusLabel(modal.draft.status)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="modalReadonlyRow">
                                                <span className="modalFieldLabel">Tags</span>
                                                <div className="modalReadonlyValue">
                                                    {modal.draft.tagIds.length === 0 ? (
                                                        <span className="muted">—</span>
                                                    ) : (
                                                        <div className="tasksTagCell">
                                                            {modal.draft.tagIds.map((id) => {
                                                                const tg = allTags.find((x) => x.id === id)
                                                                const name = tg?.name ?? id
                                                                const tc =
                                                                    tg?.color &&
                                                                    /^#[0-9A-Fa-f]{6}$/i.test(tg.color)
                                                                        ? tg.color.toLowerCase()
                                                                        : FALLBACK_FEATURE_COLOR
                                                                return (
                                                                    <span
                                                                        key={id}
                                                                        className="tagChip"
                                                                        style={{
                                                                            backgroundColor: tc,
                                                                            color: chipTextColor(tc),
                                                                        }}
                                                                    >
                                                                        #{name}
                                                                    </span>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="modalDescriptionBlock">
                                                <span className="modalFieldLabel">Description</span>
                                                {modal.draft.description.trim().length > 0 ? (
                                                    <div className="modalDescriptionMarkdownWrap">
                                                        <TaskDescriptionMarkdown markdown={modal.draft.description} />
                                                    </div>
                                                ) : (
                                                    <div className="muted modalReadonlyValue" style={{ marginTop: 6 }}>
                                                        No description
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="modalFooter">
                                        <button type="button" className="btn btnDanger" onClick={closeModal}>
                                            Cancel
                                        </button>
                                        <button type="button" className="btn btnPrimary" onClick={toggleTaskSurface}>
                                            Edit
                                        </button>
                                    </div>
                                </>
                            )}

                            {modal.kind === 'task' && modal.surface === 'edit' && (
                                <>
                                    <div className="modalTaskScroll">
                                        <div className="modalFormGrid">
                                            <label className="modalFieldLabel" htmlFor="task-edit-title">
                                                Title
                                            </label>
                                            <input
                                                id="task-edit-title"
                                                className="textInput"
                                                value={modal.draft.title}
                                                onChange={(e) => patchDraft({ title: e.target.value })}
                                            />
                                            <div className="modalMetaRow">
                                                <div className="modalMetaCell">
                                                    <label className="modalFieldLabel" htmlFor="task-edit-feature">
                                                        Feature
                                                    </label>
                                                    <select
                                                        id="task-edit-feature"
                                                        className="intervalSelect"
                                                        value={modal.draft.featureId}
                                                        onChange={(e) =>
                                                            patchDraft({
                                                                featureId: e.target.value,
                                                                parentTaskId: '',
                                                            })
                                                        }
                                                    >
                                                        {features.map((f) => (
                                                            <option key={f.id} value={f.id}>
                                                                {f.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="modalMetaCell">
                                                    <label className="modalFieldLabel" htmlFor="task-edit-category">
                                                        Category
                                                    </label>
                                                    <select
                                                        id="task-edit-category"
                                                        className="intervalSelect"
                                                        value={modal.draft.categoryId}
                                                        onChange={(e) => patchDraft({ categoryId: e.target.value })}
                                                    >
                                                        <option value="">None</option>
                                                        {categories.map((c) => (
                                                            <option key={c.id} value={c.id}>
                                                                {c.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="modalMetaCell">
                                                    <label className="modalFieldLabel" htmlFor="task-edit-status">
                                                        Status
                                                    </label>
                                                    <select
                                                        id="task-edit-status"
                                                        className="intervalSelect"
                                                        value={modal.draft.status}
                                                        onChange={(e) =>
                                                            patchDraft({ status: e.target.value as TaskStatus })
                                                        }
                                                    >
                                                        {allStatus.map((s) => (
                                                            <option key={s} value={s}>
                                                                {statusLabel(s)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <label className="modalFieldLabel" htmlFor="task-edit-parent">
                                                Parent task (optional)
                                            </label>
                                            <select
                                                id="task-edit-parent"
                                                className="intervalSelect"
                                                value={modal.draft.parentTaskId}
                                                onChange={(e) => patchDraft({ parentTaskId: e.target.value })}
                                                aria-label="Parent task"
                                            >
                                                <option value="">None (root task)</option>
                                                {parentTaskPickerOptions(
                                                    tasks,
                                                    modal.draft.featureId,
                                                    modal.taskId
                                                ).map((pt) => (
                                                    <option key={pt.id} value={pt.id}>
                                                        {pt.title}
                                                    </option>
                                                ))}
                                            </select>
                                            <label className="modalFieldLabel" htmlFor="task-edit-desc">
                                                Description (markdown)
                                            </label>
                                            <textarea
                                                id="task-edit-desc"
                                                className="textArea modalTaskDescArea"
                                                value={modal.draft.description}
                                                placeholder="Description (optional, markdown source)"
                                                onChange={(e) => patchDraft({ description: e.target.value })}
                                                rows={4}
                                            />
                                            <span className="modalFieldLabel">Tags</span>
                                            <div className="modalTagPicker" role="group" aria-label="Task tags">
                                                {allTags.length === 0 ? (
                                                    <span className="muted" style={{ fontSize: 13 }}>
                                                        No tags defined — add some in Configuration.
                                                    </span>
                                                ) : (
                                                    allTags.map((tg) => {
                                                        const col =
                                                            tg.color && /^#[0-9A-Fa-f]{6}$/i.test(tg.color)
                                                                ? tg.color.toLowerCase()
                                                                : FALLBACK_FEATURE_COLOR
                                                        const on = modal.draft.tagIds.includes(tg.id)
                                                        return (
                                                            <button
                                                                key={tg.id}
                                                                type="button"
                                                                className="tagChip tagChipToggle"
                                                                data-selected={on}
                                                                style={{
                                                                    backgroundColor: on ? col : 'transparent',
                                                                    color: on ? chipTextColor(col) : col,
                                                                    borderColor: col,
                                                                }}
                                                                onClick={() => toggleDraftTagId(tg.id)}
                                                            >
                                                                #{tg.name}
                                                            </button>
                                                        )
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="modalFooter">
                                        <button type="button" className="btn btnDanger" onClick={cancelEditToView}>
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btnPrimary"
                                            disabled={!canSubmitDraft(modal.draft) || state.kind === 'loading'}
                                            onClick={() => void onSaveTask()}
                                        >
                                            Save
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>,
                    document.body
                )}

            <TagTasksModal
                open={tagBrowseModalTag !== null}
                onClose={() => setTagBrowseModalTag(null)}
                gameId={gameId}
                tag={tagBrowseModalTag}
            />
        </section>
    )
}
