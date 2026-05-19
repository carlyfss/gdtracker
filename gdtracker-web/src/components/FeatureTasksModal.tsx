import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { TaskDescriptionMarkdown } from './TaskDescriptionMarkdown'
import type { Category } from '../api/categories'
import { listCategories } from '../api/categories'
import type { Feature } from '../api/features'
import { archiveFeature, unarchiveFeature, updateFeature } from '../api/features'
import type { Task, TaskStatus } from '../api/tasks'
import { listTasks } from '../api/tasks'
import { categoryMeta } from '../pages/tasks/tasksPageUtils'
import { immediateChildFeatures } from '../util/featureTree'
import { normalizeHex6 } from '../util/hexColor'
import { allStatus, isTaskDone, statusLabel } from '../util/taskStatus'
import { directChildProgress, flattenTasksForList, formatChildProgressLabel } from '../util/taskTree'

const FALLBACK_FEATURE_COLOR = '#94a3b8'

type TaskSection = {
    feature: Feature
    tasks: Task[]
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

type FeatureModalTaskTableProps = {
    tasks: Task[]
    categories: Category[]
    listShowSubtasks: boolean
    collapsedTaskIds: ReadonlySet<string>
    onToggleTaskRowCollapsed: (taskId: string) => void
    onOpenTask: (t: Task) => void
}

function FeatureModalTaskTable({
    tasks,
    categories,
    listShowSubtasks,
    collapsedTaskIds,
    onToggleTaskRowCollapsed,
    onOpenTask,
}: FeatureModalTaskTableProps) {
    const listRows = useMemo(
        () =>
            flattenTasksForList(tasks, {
                showSubtasks: listShowSubtasks,
                collapsedParentIds: collapsedTaskIds,
            }),
        [tasks, listShowSubtasks, collapsedTaskIds]
    )

    if (tasks.length === 0) {
        return <div className="emptyState featureModalSectionEmpty">No tasks</div>
    }

    return (
        <div className="tableWrap featureModalSectionTable">
            <table className="table tableCompact tableTasksList">
                <thead>
                    <tr>
                        <th className="tasksListTitleCol">Title</th>
                        <th className="tasksListProgressCol">Progress</th>
                        <th className="tasksListStatusCol">Status</th>
                        <th className="tasksListCategoryCol">Category</th>
                        <th className="tasksListActionsCol" aria-label="Actions" />
                    </tr>
                </thead>
                <tbody>
                    {listRows.map((row) => {
                        const t = row.task
                        const { done: progDone, total: progTotal } = directChildProgress(t.id, tasks)
                        const progLabels = formatChildProgressLabel(progDone, progTotal)
                        const { name: cn, color: cc } = categoryMeta(t, categories)
                        const rowExpanded = row.hasChildren && !collapsedTaskIds.has(t.id)
                        return (
                            <tr
                                key={t.id}
                                className="tasksListRow"
                                data-done={isTaskDone(t.status) ? 'true' : undefined}
                                role="button"
                                tabIndex={0}
                                aria-label={`Open task: ${t.title}`}
                                onClick={() => onOpenTask(t)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault()
                                        onOpenTask(t)
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
                                                    onToggleTaskRowCollapsed(t.id)
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
                                    <span className="tasksStatusPill" data-status={(t.status ?? 'TODO') as TaskStatus}>
                                        {statusLabel((t.status ?? 'TODO') as TaskStatus)}
                                    </span>
                                </td>
                                <td>
                                    {cn ? (
                                        <span className="filterItemInner">
                                            <span className="featureSwatch" style={{ backgroundColor: cc }} />
                                            <span style={{ color: cc }}>{cn}</span>
                                        </span>
                                    ) : (
                                        <span className="muted">—</span>
                                    )}
                                </td>
                                <td className="tasksListActionsCol" />
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

type Props = {
    open: boolean
    onClose: () => void
    gameId: string
    feature: Feature | null
    features: Feature[]
    progress: { done: number; total: number } | null
    /** Active lists omit archived tasks; archived scope loads archive-visible tasks and links to /archive. */
    taskListScope?: 'active' | 'archived'
    onAfterArchiveOrUnarchive?: () => void | Promise<void>
    onFeatureUpdated?: (feature: Feature) => void
}

export function FeatureTasksModal({
    open,
    onClose,
    gameId,
    feature,
    features,
    progress,
    taskListScope = 'active',
    onAfterArchiveOrUnarchive,
    onFeatureUpdated,
}: Props) {
    const navigate = useNavigate()
    const [sections, setSections] = useState<TaskSection[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [statusSaving, setStatusSaving] = useState(false)
    const [statusError, setStatusError] = useState<string | null>(null)
    const [listShowSubtasks, setListShowSubtasks] = useState(true)
    const [collapsedTaskIds, setCollapsedTaskIds] = useState<Set<string>>(() => new Set())

    useEffect(() => {
        if (!open || !feature) return
        let cancelled = false
        void (async () => {
            setLoading(true)
            setError(null)
            const childFeatures = immediateChildFeatures(feature.id, features)
            const sectionFeatures = [feature, ...childFeatures]
            const taskListParams = taskListScope === 'archived' ? ({ archivedOnly: true } as const) : ({} as const)
            try {
                const [cats, ...taskResults] = await Promise.all([
                    listCategories(gameId),
                    ...sectionFeatures.map((f) =>
                        listTasks(gameId, {
                            featureId: f.id,
                            ...taskListParams,
                        })
                    ),
                ])
                if (!cancelled) {
                    setCategories(cats)
                    setSections(
                        sectionFeatures.map((f, i) => ({
                            feature: f,
                            tasks: taskResults[i] ?? [],
                        }))
                    )
                }
            } catch {
                if (!cancelled) {
                    setSections([])
                    setError('Failed to load tasks.')
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [open, feature, gameId, taskListScope, features])

    const toggleTaskRowCollapsed = (taskId: string) => {
        setCollapsedTaskIds((prev) => {
            const next = new Set(prev)
            if (next.has(taskId)) next.delete(taskId)
            else next.add(taskId)
            return next
        })
    }

    if (!open || !feature) return null

    const fc = normalizeHex6(feature.color, FALLBACK_FEATURE_COLOR)
    const featureStatus = (feature.status ?? 'TODO') as TaskStatus

    const openTaskOnTasksPage = (t: Task) => {
        onClose()
        const segment = taskListScope === 'archived' ? 'archive' : 'tasks'
        navigate(
            `/g/${encodeURIComponent(gameId)}/${segment}?feature=${encodeURIComponent(feature.id)}&task=${encodeURIComponent(t.id)}`
        )
    }

    const isArchivedFeature = taskListScope === 'archived' || feature.archived === true
    const canEditStatus = !isArchivedFeature

    const onStatusChange = async (next: TaskStatus) => {
        if (!canEditStatus || next === featureStatus) return
        setStatusSaving(true)
        setStatusError(null)
        try {
            const updated = await updateFeature(gameId, feature.id, {
                name: feature.name,
                status: next,
                description: feature.description ?? null,
                color: feature.color,
                parentId: feature.parentId ?? null,
            })
            onFeatureUpdated?.(updated)
        } catch {
            setStatusError('Could not update feature status.')
        } finally {
            setStatusSaving(false)
        }
    }

    const onArchiveOrUnarchiveFeature = async () => {
        if (!feature) return
        const ok = window.confirm(
            isArchivedFeature
                ? `Unarchive feature "${feature.name}" and all of its subfeatures?`
                : `Archive feature "${feature.name}" and all of its subfeatures? They will only appear on the Archive page.`
        )
        if (!ok) return
        try {
            if (isArchivedFeature) {
                await unarchiveFeature(gameId, feature.id)
            } else {
                await archiveFeature(gameId, feature.id)
            }
            onClose()
            await onAfterArchiveOrUnarchive?.()
        } catch {
            window.alert(isArchivedFeature ? 'Could not unarchive feature.' : 'Could not archive feature.')
        }
    }

    const totalTaskCount = sections.reduce((n, s) => n + s.tasks.length, 0)

    return createPortal(
        <div className="modalBackdrop" onClick={onClose} role="presentation">
            <div
                className="modalCard modalCardTask"
                role="dialog"
                aria-modal="true"
                aria-labelledby="feature-tasks-modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modalTaskHeader">
                    <h3 className="modalTitle" id="feature-tasks-modal-title" style={{ color: fc }}>
                        {feature.name}
                    </h3>
                    <div className="modalHeaderTrailing">
                        <button
                            type="button"
                            className="modalCloseBtn"
                            onClick={onClose}
                            title="Close"
                            aria-label="Close dialog"
                        >
                            <span aria-hidden>×</span>
                        </button>
                    </div>
                </div>
                <div className="modalTaskScroll">
                    {progress && (
                        <p className="muted" style={{ margin: '0 0 8px' }}>
                            Progress: {progress.total > 0 ? Math.round((100 * progress.done) / progress.total) : 0}% (
                            {progress.done}/{progress.total} completed)
                        </p>
                    )}
                    <div className="modalFieldRow" style={{ marginBottom: 12 }}>
                        <span className="modalFieldLabel">Status</span>
                        {canEditStatus ? (
                            <select
                                className="intervalSelect"
                                value={featureStatus}
                                disabled={statusSaving}
                                onChange={(e) => void onStatusChange(e.target.value as TaskStatus)}
                                aria-label="Feature status"
                            >
                                {allStatus.map((s) => (
                                    <option key={s} value={s}>
                                        {statusLabel(s)}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <span className="tasksStatusPill" data-status={featureStatus}>
                                {statusLabel(featureStatus)}
                            </span>
                        )}
                        {statusError && (
                            <span className="banner bannerError" style={{ marginTop: 6, display: 'block' }}>
                                {statusError}
                            </span>
                        )}
                    </div>
                    {typeof feature.description === 'string' && feature.description.trim().length > 0 ? (
                        <div style={{ marginBottom: 12 }}>
                            <span className="modalFieldLabel">Description</span>
                            <TaskDescriptionMarkdown markdown={feature.description} />
                        </div>
                    ) : (
                        <p className="muted" style={{ marginBottom: 12 }}>
                            No description
                        </p>
                    )}
                    <span className="modalFieldLabel">Tasks</span>
                    {error && <div className="banner bannerError">{error}</div>}
                    {loading && <div className="emptyState">Loading tasks…</div>}
                    {!loading && !error && (
                        <>
                            {totalTaskCount > 0 && (
                                <div className="tasksListToolbar" style={{ marginTop: 8 }}>
                                    <label
                                        htmlFor="feature-modal-subtasks-visibility"
                                        className="tasksListToolbarLabel"
                                    >
                                        Subtasks
                                    </label>
                                    <select
                                        id="feature-modal-subtasks-visibility"
                                        className="intervalSelect tasksListToolbarSelect"
                                        value={listShowSubtasks ? 'show' : 'hide'}
                                        onChange={(e) => setListShowSubtasks(e.target.value === 'show')}
                                        aria-label="Show or hide subtasks in the list"
                                    >
                                        <option value="show">Show subtasks</option>
                                        <option value="hide">Hide subtasks</option>
                                    </select>
                                </div>
                            )}
                            {sections.map((section, index) => {
                                const sc = normalizeHex6(section.feature.color, FALLBACK_FEATURE_COLOR)
                                return (
                                    <div key={section.feature.id} className="featureModalTaskSection">
                                        {index > 0 && <hr className="featureModalSectionDivider" />}
                                        <h4 className="featureModalSectionHeading" style={{ color: sc }}>
                                            {section.feature.name}
                                        </h4>
                                        <FeatureModalTaskTable
                                            tasks={section.tasks}
                                            categories={categories}
                                            listShowSubtasks={listShowSubtasks}
                                            collapsedTaskIds={collapsedTaskIds}
                                            onToggleTaskRowCollapsed={toggleTaskRowCollapsed}
                                            onOpenTask={openTaskOnTasksPage}
                                        />
                                    </div>
                                )
                            })}
                            {sections.length === 0 && !loading && (
                                <div className="emptyState">No tasks for this feature.</div>
                            )}
                        </>
                    )}
                </div>
                <div className="modalFooter">
                    <button type="button" className="btn" onClick={() => void onArchiveOrUnarchiveFeature()}>
                        {isArchivedFeature ? 'Unarchive feature' : 'Archive feature'}
                    </button>
                    <button type="button" className="btn btnPrimary" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
