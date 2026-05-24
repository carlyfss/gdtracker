import type { ReactNode } from 'react'
import type { Category } from '../../../api/categories'
import type { Feature } from '../../../api/features'
import type { Tag } from '../../../api/tags'
import type { Task, TaskStatus } from '../../../api/tasks'
import { IconTrash } from '../../../components/icons'
import { SelectControl } from '../../../components/SelectControl'
import { chipTextColor } from '../../../util/chipTextColor'
import { normalizeHex6 } from '../../../util/hexColor'
import { isTaskDone, statusLabel } from '../../../util/taskStatus'
import { directChildProgress, formatChildProgressLabel, type TaskListRow } from '../../../util/taskTree'
import { IconChevronTaskTree, IconCheck } from './TaskIcons'
import { TasksListCards } from './TasksListCards'
import { categoryMeta, FALLBACK_FEATURE_COLOR, featureMeta, sortedTaskTags, type UiState } from '../tasksPageUtils'

export type TasksListTableProps = {
    tasks: Task[]
    listRows: TaskListRow[]
    listShowSubtasks: boolean
    setListShowSubtasks: (v: boolean) => void
    features: Feature[]
    categories: Category[]
    collapsedTaskIds: Set<string>
    toggleTaskRowCollapsed: (taskId: string) => void
    advancingTaskId: string | null
    state: UiState
    openTaskView: (t: Task) => void
    onAdvanceStatus: (t: Task) => void | Promise<void>
    onDelete: (t: Task) => void | Promise<void>
    onTagChipClick: (tag: Tag) => void
    mode?: 'default' | 'archiveEmbedded'
    listLoading?: boolean
    listEmpty?: boolean
    pagination?: ReactNode
}

export function TasksListTable({
    tasks,
    listRows,
    listShowSubtasks,
    setListShowSubtasks,
    features,
    categories,
    collapsedTaskIds,
    toggleTaskRowCollapsed,
    advancingTaskId,
    state,
    openTaskView,
    onAdvanceStatus,
    onDelete,
    onTagChipClick,
    mode = 'default',
    listLoading = false,
    listEmpty = false,
    pagination = null,
}: TasksListTableProps) {
    const archiveEmbedded = mode === 'archiveEmbedded'
    return (
        <div className="tableWrap tasksTableWrap">
            <TasksListCards
                listRows={listRows}
                tasks={tasks}
                features={features}
                categories={categories}
                advancingTaskId={advancingTaskId}
                state={state}
                openTaskView={openTaskView}
                onAdvanceStatus={onAdvanceStatus}
                onDelete={onDelete}
                archiveEmbedded={archiveEmbedded}
                listLoading={listLoading}
                listEmpty={listEmpty}
            />
            <div className="tasksListToolbar tasksListToolbar--table">
                <label htmlFor="tasks-subtasks-visibility" className="tasksListToolbarLabel">
                    Subtasks
                </label>
                <SelectControl
                    id="tasks-subtasks-visibility"
                    className="tasksListToolbarSelect"
                    value={listShowSubtasks ? 'show' : 'hide'}
                    onChange={(v) => setListShowSubtasks(v === 'show')}
                    options={[
                        { value: 'show', label: 'Show subtasks' },
                        { value: 'hide', label: 'Hide subtasks' },
                    ]}
                    aria-label="Show or hide subtasks in the list"
                />
                {pagination}
            </div>
            <div className="tasksTableScroll tasksTableScroll--desktop">
                <table className="table tableCompact tableTasksList">
                    <thead>
                        <tr>
                            <th className="tasksListTitleCol">Title</th>
                            <th className="tasksListProgressCol">Progress</th>
                            {archiveEmbedded ? null : <th className="tasksListStatusCol">Status</th>}
                            {archiveEmbedded ? null : <th className="tasksListFeatureCol">Feature</th>}
                            <th className="tasksListCategoryCol">Category</th>
                            <th className="tasksListTagCol">Tag</th>
                            <th className="tasksListActionsCol" aria-label="Actions" />
                        </tr>
                    </thead>
                    <tbody>
                        {listLoading && listRows.length === 0 ? (
                            <tr>
                                <td colSpan={archiveEmbedded ? 5 : 7}>
                                    <div className="emptyState">Loading…</div>
                                </td>
                            </tr>
                        ) : null}
                        {!listLoading && listEmpty ? (
                            <tr>
                                <td colSpan={archiveEmbedded ? 5 : 7}>
                                    <div className="emptyState">No tasks match your filters.</div>
                                </td>
                            </tr>
                        ) : null}
                        {listRows.map((row, idx) => {
                            const t = row.task
                            const { name: fn, color: fc } = featureMeta(t, features)
                            const { name: cn, color: cc } = categoryMeta(t, categories)
                            const atDone = isTaskDone(t.status)
                            const busyRow = advancingTaskId === t.id
                            const { done: progDone, total: progTotal } = directChildProgress(t.id, tasks)
                            const progLabels = formatChildProgressLabel(progDone, progTotal)
                            const showFeature = row.depth === 0
                            const rowTags = sortedTaskTags(t)
                            const rowExpanded = row.hasChildren && !collapsedTaskIds.has(t.id)
                            return (
                                <tr
                                    key={t.id}
                                    className="tasksListRow"
                                    data-done={atDone ? 'true' : undefined}
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
                                    {archiveEmbedded ? null : (
                                        <td className="tasksListStatusCol">
                                            <span
                                                className="tasksStatusPill"
                                                data-status={(t.status as TaskStatus) ?? 'TODO'}
                                            >
                                                {statusLabel(t.status as TaskStatus)}
                                            </span>
                                        </td>
                                    )}
                                    {archiveEmbedded ? null : (
                                        <td>
                                            {showFeature ? (
                                                <span className="filterItemInner">
                                                    <span className="featureSwatch" style={{ backgroundColor: fc }} />
                                                    <span style={{ color: fc }}>{fn}</span>
                                                </span>
                                            ) : (
                                                <span className="muted">—</span>
                                            )}
                                        </td>
                                    )}
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
                                    <td className="tasksListTagCol">
                                        {rowTags.length > 0 ? (
                                            <div className="tasksTagCell">
                                                {rowTags.map((tg) => {
                                                    const tc = normalizeHex6(tg.color, FALLBACK_FEATURE_COLOR)
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
                                                                onTagChipClick(tg)
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
                                            {archiveEmbedded ? null : (
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
                                            )}
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
        </div>
    )
}
