import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { TaskDescriptionMarkdown } from './TaskDescriptionMarkdown'
import type { Category } from '../api/categories'
import { listCategories } from '../api/categories'
import type { Feature } from '../api/features'
import { archiveFeature, unarchiveFeature } from '../api/features'
import type { Task, TaskStatus } from '../api/tasks'
import { listTasks } from '../api/tasks'
import { categoryMeta } from '../pages/tasks/tasksPageUtils'
import { normalizeHex6 } from '../util/hexColor'
import { statusLabel } from '../util/taskStatus'
import { directChildProgress, flattenTasksForList, formatChildProgressLabel } from '../util/taskTree'

const FALLBACK_FEATURE_COLOR = '#94a3b8'

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

type Props = {
    open: boolean
    onClose: () => void
    gameId: string
    feature: Feature | null
    progress: { done: number; total: number } | null
    /** Active lists omit archived tasks; archived scope loads archive-visible tasks and links to /archive. */
    taskListScope?: 'active' | 'archived'
    onAfterArchiveOrUnarchive?: () => void | Promise<void>
}

export function FeatureTasksModal({
    open,
    onClose,
    gameId,
    feature,
    progress,
    taskListScope = 'active',
    onAfterArchiveOrUnarchive,
}: Props) {
    const navigate = useNavigate()
    const [tasks, setTasks] = useState<Task[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [listShowSubtasks, setListShowSubtasks] = useState(true)
    const [collapsedTaskIds, setCollapsedTaskIds] = useState<Set<string>>(() => new Set())

    useEffect(() => {
        if (!open || !feature) return
        let cancelled = false
        void (async () => {
            setLoading(true)
            setError(null)
            try {
                const [data, cats] = await Promise.all([
                    listTasks(gameId, {
                        featureId: feature.id,
                        ...(taskListScope === 'archived' ? { archivedOnly: true } : {}),
                    }),
                    listCategories(gameId),
                ])
                if (!cancelled) {
                    setTasks(data)
                    setCategories(cats)
                }
            } catch {
                if (!cancelled) {
                    setTasks([])
                    setError('Failed to load tasks.')
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [open, feature, gameId, taskListScope])

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

    if (!open || !feature) return null

    const fc = normalizeHex6(feature.color, FALLBACK_FEATURE_COLOR)

    const openTaskOnTasksPage = (t: Task) => {
        onClose()
        const segment = taskListScope === 'archived' ? 'archive' : 'tasks'
        navigate(
            `/g/${encodeURIComponent(gameId)}/${segment}?feature=${encodeURIComponent(feature.id)}&task=${encodeURIComponent(t.id)}`
        )
    }

    const isArchivedFeature = taskListScope === 'archived' || feature.archived === true

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
                    {!loading && tasks.length === 0 && !error && (
                        <div className="emptyState">No tasks for this feature.</div>
                    )}
                    {!loading && tasks.length > 0 && (
                        <div className="tableWrap" style={{ marginTop: 8 }}>
                            <div className="tasksListToolbar">
                                <label htmlFor="feature-modal-subtasks-visibility" className="tasksListToolbarLabel">
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
                                                role="button"
                                                tabIndex={0}
                                                aria-label={`Open task: ${t.title}`}
                                                onClick={() => openTaskOnTasksPage(t)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault()
                                                        openTaskOnTasksPage(t)
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
                                                        data-status={(t.status ?? 'TODO') as TaskStatus}
                                                    >
                                                        {statusLabel((t.status ?? 'TODO') as TaskStatus)}
                                                    </span>
                                                </td>
                                                <td>
                                                    {cn ? (
                                                        <span className="filterItemInner">
                                                            <span
                                                                className="featureSwatch"
                                                                style={{ backgroundColor: cc }}
                                                            />
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
