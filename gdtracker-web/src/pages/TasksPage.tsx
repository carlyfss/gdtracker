import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { TagTasksModal } from '../components/TagTasksModal'
import { useGameId } from '../context/GameIdContext'
import type { Category } from '../api/categories'
import { listCategories } from '../api/categories'
import type { Tag } from '../api/tags'
import { listTags } from '../api/tags'
import { getConfiguration } from '../api/configuration'
import type { Feature } from '../api/features'
import { listFeatures } from '../api/features'
import type { Task, TaskStatus } from '../api/tasks'
import { archiveTask, createTask, deleteTask, listTasks, unarchiveTask, updateTask } from '../api/tasks'
import { nextTaskStatus, statusLabel } from '../util/taskStatus'
import { readLastTaskFeatureId, writeLastTaskFeatureId } from '../util/taskUiPreferences'
import { flattenTasksForList } from '../util/taskTree'
import { TaskModal } from './tasks/components/TaskModal'
import { TasksFilterPanel } from './tasks/components/TasksFilterPanel'
import { TasksListTable } from './tasks/components/TasksListTable'
import {
    type CreateFromExceptionState,
    applyParentTaskDraftPatch,
    draftFromTask,
    emptyDraft,
    normalizeTitle,
    parentTaskPickerOptions as _parentTaskPickerOptions,
    type TaskDraft,
    type TaskModal as TaskModalState,
    tagIdsFromTask,
    type UiState,
    upsertBodyParentId,
} from './tasks/tasksPageUtils'

// Keep helper visible for type narrowing in some lint configs.
void _parentTaskPickerOptions

export type TasksPageBodyProps = {
    gameId: string
    /** When true, load and show only archive-visible tasks; hide create flow. */
    archivedOnly?: boolean
    /** Full page vs right column in Archive layout. */
    layout?: 'page' | 'embedded'
    /** When set, force tasks list to this feature id (no filter rail). */
    forcedFeatureId?: string | null
}

export function TasksPageBody({ gameId, archivedOnly = false, layout = 'page', forcedFeatureId }: TasksPageBodyProps) {
    const navigate = useNavigate()
    const location = useLocation()
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

    const [modal, setModal] = useState<TaskModalState>({ kind: 'closed' })
    const [tagBrowseModalTag, setTagBrowseModalTag] = useState<Tag | null>(null)

    const skipFilterRefreshOnce = useRef(true)
    /** After first bootstrap completes; state (not a ref) so `createFromException` effect re-runs when this flips true. */
    const [taskPageBootstrapDone, setTaskPageBootstrapDone] = useState(false)

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
            const data = await listFeatures(gameId, archivedOnly ? { archived: true } : {})
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
        const effectiveFeatureId = forcedFeatureId ?? (selectedFeatureId !== '__all__' ? selectedFeatureId : undefined)
        const categoryId = selectedCategoryId !== '__all__' ? selectedCategoryId : undefined
        const status = selectedStatus !== '__all__' ? selectedStatus : undefined
        const tagIds = selectedFilterTagIds.length > 0 ? selectedFilterTagIds : undefined
        try {
            const data = await listTasks(gameId, {
                featureId: effectiveFeatureId ?? undefined,
                status,
                categoryId,
                ...(archivedOnly ? { archivedOnly: true } : {}),
                ...(tagIds
                    ? {
                          tagIds,
                          ...(tagIds.length >= 2 ? { tagMode: tagFilterMode } : {}),
                      }
                    : {}),
            })
            // The list endpoint returns sparse refs (id-only) for feature/category/tags. Re-hydrate from the
            // already-loaded lookup snapshots so downstream UI (chips, filter pills) has full names/colors
            // even on the very first paint after bootstrap. `opts` lets the bootstrap pass freshly-fetched
            // snapshots before component state has caught up.
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
        let cancelled = false
        const timer = window.setTimeout(() => {
            setTaskPageBootstrapDone(false)
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
                        setGameDefaultCategoryId(cfg.exceptionTaskTemplate?.defaultCategoryId ?? null)
                    } catch {
                        setGameDefaultCategoryId(null)
                    }
                    await refreshTasks({ featuresSnapshot: f, categoriesSnapshot: cats, tagsSnapshot: tagsSnap })
                    setState({ kind: 'idle' })
                } catch {
                    setState({ kind: 'error', message: 'Failed to load tasks.' })
                } finally {
                    if (!cancelled) {
                        setTaskPageBootstrapDone(true)
                    }
                }
            })()
        }, 0)
        return () => {
            cancelled = true
            window.clearTimeout(timer)
        }
        // refreshFeatures / refreshTasks close over gameId and filter state; include gameId only to avoid redundant loads.
        // eslint-disable-next-line react-hooks/exhaustive-deps -- mount and gameId change
    }, [gameId, archivedOnly])

    useEffect(() => {
        const id = window.setTimeout(() => {
            const f = searchParams.get('feature')
            if (f && forcedFeatureId == null) setSelectedFeatureId(f)
            const t = searchParams.get('task')
            if (f || t) {
                setSelectedCategoryId('__all__')
                setSelectedStatus('__all__')
            }
        }, 0)
        return () => window.clearTimeout(id)
    }, [searchParams, forcedFeatureId])

    useEffect(() => {
        if (forcedFeatureId == null) return
        const t = window.setTimeout(() => {
            setSelectedFeatureId(forcedFeatureId)
            setSelectedCategoryId('__all__')
            setSelectedStatus('__all__')
            setSelectedFilterTagIds([])
        }, 0)
        return () => window.clearTimeout(t)
    }, [forcedFeatureId])

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
                const all = await listTasks(gameId, archivedOnly ? { archivedOnly: true } : {})
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
    }, [tasks, searchParams, setSearchParams, gameId, archivedOnly])

    useEffect(() => {
        if (archivedOnly) return
        const raw = location.state as { createFromException?: CreateFromExceptionState } | null
        const c = raw?.createFromException
        if (!c?.exceptionId) return
        if (!taskPageBootstrapDone) return
        if (features.length === 0) return

        const featureIds = features.map((f) => f.id)
        const storedFeature = readLastTaskFeatureId(gameId, featureIds)
        const featureId =
            storedFeature ??
            (selectedFeatureId !== '__all__' && features.some((f) => f.id === selectedFeatureId)
                ? selectedFeatureId
                : features[0]!.id)

        let catId = ''
        if (c.categoryId && categories.some((x) => x.id === c.categoryId)) {
            catId = c.categoryId
        } else if (gameDefaultCategoryId && categories.some((x) => x.id === gameDefaultCategoryId)) {
            catId = gameDefaultCategoryId
        } else if (categories.length > 0) {
            catId = categories[0]!.id
        }

        const timer = window.setTimeout(() => {
            setModal({
                kind: 'create',
                draft: {
                    title: c.title,
                    description: c.description,
                    status: 'TODO',
                    featureId,
                    categoryId: catId,
                    parentTaskId: '',
                    tagIds: [],
                    sourceGameExceptionId: c.exceptionId,
                    planningDocumentRefs: [],
                },
            })
            navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: {} })
        }, 0)
        return () => window.clearTimeout(timer)
    }, [
        location.state,
        location.pathname,
        location.search,
        features,
        categories,
        gameDefaultCategoryId,
        selectedFeatureId,
        gameId,
        navigate,
        archivedOnly,
        taskPageBootstrapDone,
    ])

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
    }, [
        selectedFeatureId,
        selectedCategoryId,
        selectedFilterTagIds,
        tagFilterMode,
        selectedStatus,
        gameId,
        archivedOnly,
    ])

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
        const featureIds = features.map((f) => f.id)
        const stored = readLastTaskFeatureId(gameId, featureIds)
        if (stored) return stored
        if (selectedFeatureId !== '__all__' && features.some((f) => f.id === selectedFeatureId)) {
            return selectedFeatureId
        }
        return features[0]!.id
    }, [features, selectedFeatureId, gameId])

    const onFilterFeatureChange = (featureId: string) => {
        setSelectedFeatureId(featureId)
        if (featureId !== '__all__') {
            writeLastTaskFeatureId(gameId, featureId)
        }
    }

    const canSubmitDraft = (d: TaskDraft) => normalizeTitle(d.title).length > 0 && d.featureId.length > 0

    const openCreateModal = () => {
        if (features.length === 0) return
        setModal({
            kind: 'create',
            draft: emptyDraft(defaultFeatureIdForCreate, ''),
        })
    }

    const openTaskView = (t: Task) => {
        setModal({ kind: 'task', taskId: t.id, surface: 'view', draft: draftFromTask(t) })
    }

    const closeModal = () => setModal({ kind: 'closed' })

    const patchDraft = (patch: Partial<TaskDraft>) => {
        setModal((prev) => {
            if (prev.kind === 'closed') return prev
            const merged = applyParentTaskDraftPatch(tasks, patch)
            let nextDraft: TaskDraft = { ...prev.draft, ...merged }
            if (
                Object.prototype.hasOwnProperty.call(merged, 'featureId') &&
                merged.featureId !== prev.draft.featureId &&
                prev.draft.parentTaskId.trim().length === 0
            ) {
                nextDraft = { ...nextDraft, parentTaskId: '' }
            }
            return { ...prev, draft: nextDraft }
        })
    }

    const onModalFeatureChange = (featureId: string) => {
        patchDraft({ featureId })
        writeLastTaskFeatureId(gameId, featureId)
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
            const sid = modal.draft.sourceGameExceptionId.trim()
            await createTask(gameId, {
                title,
                description: modal.draft.description.trim().length ? modal.draft.description : null,
                status: modal.draft.status,
                featureId: modal.draft.featureId,
                categoryId: modal.draft.categoryId.trim().length > 0 ? modal.draft.categoryId.trim() : null,
                tagIds: modal.draft.tagIds,
                parentTaskId: upsertBodyParentId(modal.draft),
                planningNodeIds: modal.draft.planningDocumentRefs.map((r) => r.id),
                ...(sid.length > 0 ? { sourceGameExceptionId: sid } : {}),
            })
            writeLastTaskFeatureId(gameId, modal.draft.featureId)
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
                sourceGameExceptionId: modal.draft.sourceGameExceptionId.trim(),
                planningNodeIds: modal.draft.planningDocumentRefs.map((r) => r.id),
            })
            writeLastTaskFeatureId(gameId, modal.draft.featureId)
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

    const onArchiveTask = async () => {
        if (modal.kind !== 'task') return
        const ok = window.confirm('Archive this task? It will only appear on the Archive page.')
        if (!ok) return
        setState({ kind: 'loading', message: 'Archiving…' })
        try {
            await archiveTask(gameId, modal.taskId)
            closeModal()
            await refreshTasks()
            setState({ kind: 'success', message: 'Task archived.' })
        } catch {
            setState({ kind: 'error', message: 'Failed to archive task.' })
        }
    }

    const onUnarchiveTask = async () => {
        if (modal.kind !== 'task') return
        const ok = window.confirm('Unarchive this task? It will return to the active task list.')
        if (!ok) return
        setState({ kind: 'loading', message: 'Unarchiving…' })
        try {
            await unarchiveTask(gameId, modal.taskId)
            closeModal()
            await refreshTasks()
            await refreshFeatures()
            setState({ kind: 'success', message: 'Task unarchived.' })
        } catch {
            setState({ kind: 'error', message: 'Failed to unarchive task.' })
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
            const sid = typeof t.sourceGameExceptionId === 'string' ? t.sourceGameExceptionId.trim() : ''
            await updateTask(gameId, t.id, {
                title: t.title,
                description: typeof t.description === 'string' ? t.description : null,
                status: next,
                featureId,
                categoryId: categoryId.length > 0 ? categoryId : null,
                tagIds: tagIdsFromTask(t),
                parentTaskId: typeof pid === 'string' && pid.length > 0 ? pid : null,
                sourceGameExceptionId: sid,
            })
            await refreshTasks()
        } catch {
            setState({ kind: 'error', message: 'Failed to advance status.' })
        } finally {
            setAdvancingTaskId(null)
        }
    }

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
            const labels = selectedFilterTagIds.map((id) => allTags.find((x) => x.id === id)?.name ?? id).join(', ')
            parts.push(`Tags (${tagFilterMode}): ${labels}`)
        }
        return parts.length ? parts.join(' • ') : archivedOnly ? 'All archived tasks' : 'All tasks'
    }, [
        allTags,
        archivedOnly,
        categories,
        features,
        selectedCategoryId,
        selectedFeatureId,
        selectedFilterTagIds,
        tagFilterMode,
        selectedStatus,
    ])

    const showFilterPanel = !(archivedOnly && layout === 'embedded') && forcedFeatureId == null

    const tasksLayoutBody = (
        <div className={`cardBody tasksLayout ${showFilterPanel ? '' : 'tasksLayoutSingleColumn'}`.trim()}>
            {showFilterPanel ? (
                <TasksFilterPanel
                    gameId={gameId}
                    archivedOnly={archivedOnly}
                    state={state}
                    features={features}
                    categories={categories}
                    allTags={allTags}
                    selectedFeatureId={selectedFeatureId}
                    setSelectedFeatureId={onFilterFeatureChange}
                    selectedCategoryId={selectedCategoryId}
                    setSelectedCategoryId={setSelectedCategoryId}
                    selectedFilterTagIds={selectedFilterTagIds}
                    toggleFilterTagId={toggleFilterTagId}
                    tagFilterMode={tagFilterMode}
                    setTagFilterMode={setTagFilterMode}
                    selectedStatus={selectedStatus}
                    setSelectedStatus={setSelectedStatus}
                    openCreateModal={openCreateModal}
                />
            ) : null}

            <div className="tasksContent">
                {state.kind === 'error' && <div className="banner bannerError">{state.message}</div>}
                {state.kind === 'success' && <div className="banner bannerSuccess">{state.message}</div>}
                {state.kind === 'loading' && <div className="banner">{state.message}</div>}

                {tasks.length === 0 && state.kind !== 'loading' && (
                    <div className="emptyState">No tasks match your filters.</div>
                )}

                {tasks.length > 0 && (
                    <TasksListTable
                        tasks={tasks}
                        listRows={listRows}
                        listShowSubtasks={listShowSubtasks}
                        setListShowSubtasks={setListShowSubtasks}
                        features={features}
                        categories={categories}
                        collapsedTaskIds={collapsedTaskIds}
                        toggleTaskRowCollapsed={toggleTaskRowCollapsed}
                        advancingTaskId={advancingTaskId}
                        state={state}
                        openTaskView={openTaskView}
                        onAdvanceStatus={onAdvanceStatus}
                        onDelete={onDelete}
                        onTagChipClick={(tg) => setTagBrowseModalTag(tg)}
                        mode={archivedOnly && layout === 'embedded' ? 'archiveEmbedded' : 'default'}
                    />
                )}
            </div>
        </div>
    )

    return (
        <>
            {layout === 'page' ? (
                <section className="gamePageSection">
                    <div className="cardHeader">
                        <h2 className="cardTitle">{archivedOnly ? 'Archived tasks' : 'Tasks'}</h2>
                        <div className="cardHeaderMetaRow">
                            <span className="muted" style={{ fontSize: 13 }}>
                                {filteredCountLabel}
                            </span>
                            <span className="muted" style={{ fontSize: 13 }} aria-live="polite">
                                {tasks.length} shown
                            </span>
                        </div>
                    </div>
                    {tasksLayoutBody}
                </section>
            ) : (
                tasksLayoutBody
            )}

            <TaskModal
                modal={modal}
                state={state}
                archivedOnly={archivedOnly}
                gameId={gameId}
                features={features}
                categories={categories}
                allTags={allTags}
                tasks={tasks}
                canSubmitDraft={canSubmitDraft}
                onOpenSubtask={openTaskView}
                closeModal={closeModal}
                toggleTaskSurface={toggleTaskSurface}
                cancelEditToView={cancelEditToView}
                patchDraft={patchDraft}
                onModalFeatureChange={onModalFeatureChange}
                toggleDraftTagId={toggleDraftTagId}
                onCreate={onCreate}
                onSaveTask={onSaveTask}
                onArchiveTask={archivedOnly ? onUnarchiveTask : onArchiveTask}
                featureNameById={featureNameById}
                categoryNameById={categoryNameById}
            />

            <TagTasksModal
                open={tagBrowseModalTag !== null}
                onClose={() => setTagBrowseModalTag(null)}
                gameId={gameId}
                tag={tagBrowseModalTag}
                taskListScope={archivedOnly ? 'archived' : 'active'}
            />
        </>
    )
}

export function TasksPage() {
    const gameId = useGameId()
    return <TasksPageBody gameId={gameId} archivedOnly={false} layout="page" />
}
