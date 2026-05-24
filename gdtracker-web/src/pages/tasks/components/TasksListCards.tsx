import type { Category } from '../../../api/categories'
import type { Feature } from '../../../api/features'
import type { Task, TaskStatus } from '../../../api/tasks'
import { IconTrash } from '../../../components/icons'
import { isTaskDone, statusLabel } from '../../../util/taskStatus'
import { directChildProgress, formatChildProgressLabel, type TaskListRow } from '../../../util/taskTree'
import { IconCheck } from './TaskIcons'
import { categoryMeta, featureMeta, type UiState } from '../tasksPageUtils'

export type TasksListCardsProps = {
    listRows: TaskListRow[]
    tasks: Task[]
    features: Feature[]
    categories: Category[]
    advancingTaskId: string | null
    state: UiState
    openTaskView: (t: Task) => void
    onAdvanceStatus: (t: Task) => void | Promise<void>
    onDelete: (t: Task) => void | Promise<void>
    archiveEmbedded?: boolean
    listLoading?: boolean
    listEmpty?: boolean
}

export function TasksListCards({
    listRows,
    tasks,
    features,
    categories,
    advancingTaskId,
    state,
    openTaskView,
    onAdvanceStatus,
    onDelete,
    archiveEmbedded = false,
    listLoading = false,
    listEmpty = false,
}: TasksListCardsProps) {
    if (listLoading && listRows.length === 0) {
        return <div className="tasksListCards emptyState">Loading…</div>
    }
    if (!listLoading && listEmpty) {
        return <div className="tasksListCards emptyState">No tasks match your filters.</div>
    }

    return (
        <ul className="tasksListCards" aria-label="Tasks">
            {listRows.map((row) => {
                const t = row.task
                const { name: fn, color: fc } = featureMeta(t, features)
                const { name: cn } = categoryMeta(t, categories)
                const atDone = isTaskDone(t.status)
                const busyRow = advancingTaskId === t.id
                const { done: progDone, total: progTotal } = directChildProgress(t.id, tasks)
                const progLabels = formatChildProgressLabel(progDone, progTotal)
                const showFeature = row.depth === 0 && !archiveEmbedded

                return (
                    <li key={t.id} className="tasksListCard" data-done={atDone ? 'true' : undefined}>
                        <button type="button" className="tasksListCardMain" onClick={() => openTaskView(t)}>
                            <span className="tasksListCardTitle">{t.title}</span>
                            {!archiveEmbedded ? (
                                <span className="tasksStatusPill" data-status={(t.status as TaskStatus) ?? 'TODO'}>
                                    {statusLabel(t.status as TaskStatus)}
                                </span>
                            ) : null}
                            {showFeature && fn ? (
                                <span className="tasksListCardMeta">
                                    <span className="featureSwatch" style={{ backgroundColor: fc }} aria-hidden />
                                    {fn}
                                </span>
                            ) : null}
                            {cn ? <span className="tasksListCardMeta muted">Category: {cn}</span> : null}
                            {progTotal > 0 ? (
                                <span className="tasksListCardMeta muted">
                                    Progress {progLabels.pct} ({progLabels.ratio})
                                </span>
                            ) : null}
                        </button>
                        <div className="tasksListCardActions">
                            {!archiveEmbedded ? (
                                <button
                                    type="button"
                                    className="iconBtn tasksListCardActionBtn"
                                    title={atDone ? 'Task is done' : 'Advance to next status'}
                                    aria-label="Advance to next status"
                                    disabled={atDone || busyRow || state.kind === 'loading'}
                                    onClick={() => void onAdvanceStatus(t)}
                                >
                                    <IconCheck />
                                </button>
                            ) : null}
                            <button
                                type="button"
                                className="iconBtn iconBtnDanger tasksListCardActionBtn"
                                title="Delete task"
                                aria-label="Delete task"
                                onClick={() => void onDelete(t)}
                            >
                                <IconTrash />
                            </button>
                        </div>
                    </li>
                )
            })}
        </ul>
    )
}
