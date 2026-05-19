import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { Tag } from '../api/tags'
import type { Task, TaskStatus } from '../api/tasks'
import { listTasks } from '../api/tasks'
import { SelectControl } from './SelectControl'
import { chipTextColor } from '../util/chipTextColor'
import { normalizeHex6 } from '../util/hexColor'
import { isTaskDone, statusLabel } from '../util/taskStatus'
import { directChildProgress, flattenTasksForList, formatChildProgressLabel } from '../util/taskTree'

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
    tag: Tag | null
    taskListScope?: 'active' | 'archived'
}

export function TagTasksModal({ open, onClose, gameId, tag, taskListScope = 'active' }: Props) {
    const navigate = useNavigate()
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [listShowSubtasks, setListShowSubtasks] = useState(true)
    const [collapsedTaskIds, setCollapsedTaskIds] = useState<Set<string>>(() => new Set())

    useEffect(() => {
        if (!open || !tag) return
        let cancelled = false
        void (async () => {
            setLoading(true)
            setError(null)
            try {
                const data = await listTasks(gameId, {
                    tagIds: [tag.id],
                    ...(taskListScope === 'archived' ? { archivedOnly: true } : {}),
                })
                if (!cancelled) setTasks(data)
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
    }, [open, tag, gameId, taskListScope])

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

    if (!open || !tag) return null

    const th = normalizeHex6(tag.color, '#818cf8')

    const openTaskOnTasksPage = (t: Task) => {
        onClose()
        const segment = taskListScope === 'archived' ? 'archive' : 'tasks'
        navigate(`/g/${encodeURIComponent(gameId)}/${segment}?task=${encodeURIComponent(t.id)}`)
    }

    return createPortal(
        <div className="modalBackdrop" onClick={onClose} role="presentation">
            <div
                className="modalCard modalCardTask"
                role="dialog"
                aria-modal="true"
                aria-labelledby="tag-tasks-modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modalTaskHeader">
                    <h3
                        className="modalTitle"
                        id="tag-tasks-modal-title"
                        style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                    >
                        <span
                            className="tagChip"
                            style={{
                                backgroundColor: th,
                                color: chipTextColor(th),
                            }}
                        >
                            #{tag.name}
                        </span>
                        <span style={{ fontWeight: 650 }}>Tasks</span>
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
                    {typeof tag.description === 'string' && tag.description.trim().length > 0 ? (
                        <p className="muted" style={{ margin: '0 0 8px', fontSize: 13 }}>
                            {tag.description}
                        </p>
                    ) : null}
                    {error && <div className="banner bannerError">{error}</div>}
                    {loading && <div className="emptyState">Loading tasks…</div>}
                    {!loading && tasks.length === 0 && !error && (
                        <div className="emptyState">No tasks with this tag.</div>
                    )}
                    {!loading && tasks.length > 0 && (
                        <div className="tableWrap" style={{ marginTop: 8 }}>
                            <div className="tasksListToolbar">
                                <label htmlFor="tag-modal-subtasks-visibility" className="tasksListToolbarLabel">
                                    Subtasks
                                </label>
                                <SelectControl
                                    id="tag-modal-subtasks-visibility"
                                    className="tasksListToolbarSelect"
                                    value={listShowSubtasks ? 'show' : 'hide'}
                                    onChange={(v) => setListShowSubtasks(v === 'show')}
                                    options={[
                                        { value: 'show', label: 'Show subtasks' },
                                        { value: 'hide', label: 'Hide subtasks' },
                                    ]}
                                    aria-label="Show or hide subtasks in the list"
                                />
                            </div>
                            <table className="table tableCompact tableTasksList">
                                <thead>
                                    <tr>
                                        <th className="tasksListTitleCol">Title</th>
                                        <th className="tasksListProgressCol">Progress</th>
                                        <th className="tasksListStatusCol">Status</th>
                                        <th className="tasksListFeatureCol">Feature</th>
                                        <th className="tasksListCategoryCol">Category</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {listRows.map((row) => {
                                        const t = row.task
                                        const { done: progDone, total: progTotal } = directChildProgress(t.id, tasks)
                                        const progLabels = formatChildProgressLabel(progDone, progTotal)
                                        const showMeta = row.depth === 0
                                        const rowExpanded = row.hasChildren && !collapsedTaskIds.has(t.id)
                                        return (
                                            <tr
                                                key={t.id}
                                                className="tasksListRow"
                                                data-done={isTaskDone(t.status) ? 'true' : undefined}
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
                                                    {showMeta ? (
                                                        <span style={{ color: 'var(--text-h)' }}>
                                                            {t.feature?.name ?? '—'}
                                                        </span>
                                                    ) : (
                                                        <span className="muted">—</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {showMeta ? (
                                                        <span style={{ color: 'var(--text-h)' }}>
                                                            {t.category?.name ?? '—'}
                                                        </span>
                                                    ) : (
                                                        <span className="muted">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="modalFooter">
                    <button type="button" className="btn btnPrimary" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
