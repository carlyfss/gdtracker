import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { listPlanningNodes, type PlanningNodeMeta } from '../../../api/planning'
import type { Category } from '../../../api/categories'
import type { Feature } from '../../../api/features'
import type { Tag } from '../../../api/tags'
import type { Task, TaskPlanningDocumentRef, TaskStatus } from '../../../api/tasks'
import { SelectControl } from '../../../components/SelectControl'
import { TaskDescriptionMarkdown } from '../../../components/TaskDescriptionMarkdown'
import { chipTextColor } from '../../../util/chipTextColor'
import { normalizeHex6 } from '../../../util/hexColor'
import { allStatus, statusLabel } from '../../../util/taskStatus'
import { IconClose } from './TaskIcons'
import {
    FALLBACK_FEATURE_COLOR,
    parentTaskPickerOptions,
    type TaskDraft,
    type TaskModal as TaskModalState,
    type UiState,
} from '../tasksPageUtils'

const MAX_TASK_PLANNING_DOC_REFS = 20

const TASK_STATUS_OPTIONS = allStatus.map((s) => ({ value: s, label: statusLabel(s) }))

function TaskPlanningDocRefsReadonly({
    refs,
    gameId,
    closeModal,
}: {
    refs: TaskPlanningDocumentRef[]
    gameId: string
    closeModal: () => void
}) {
    if (refs.length === 0) {
        return <p className="muted modalParentTaskEmpty">No linked documents.</p>
    }
    return (
        <ul className="modalPlanningDocRefsList">
            {refs.map((r) => (
                <li key={r.id}>
                    <Link
                        className="modalSubtaskRowBtn modalPlanningDocRefLink"
                        to={`/g/${encodeURIComponent(gameId)}/planning?doc=${encodeURIComponent(r.id)}`}
                        onClick={closeModal}
                    >
                        <span className="modalSubtaskTitle">{r.name || r.id}</span>
                        <span className="modalSubtaskStatus muted">{r.kind}</span>
                    </Link>
                </li>
            ))}
        </ul>
    )
}

function TaskPlanningDocRefsEditable({
    draft,
    patchDraft,
    planningNodeList,
}: {
    draft: TaskDraft
    patchDraft: (patch: Partial<TaskDraft>) => void
    planningNodeList: PlanningNodeMeta[]
}) {
    const addable = useMemo(() => {
        const sel = new Set(draft.planningDocumentRefs.map((x) => x.id))
        return planningNodeList.filter((n) => (n.kind === 'markdown' || n.kind === 'excalidraw') && !sel.has(n.id))
    }, [planningNodeList, draft.planningDocumentRefs])

    const onPick = (nodeId: string) => {
        const node = planningNodeList.find((n) => n.id === nodeId)
        if (!node || (node.kind !== 'markdown' && node.kind !== 'excalidraw')) return
        if (draft.planningDocumentRefs.length >= MAX_TASK_PLANNING_DOC_REFS) return
        const ref: TaskPlanningDocumentRef = { id: node.id, name: node.name, kind: node.kind }
        patchDraft({ planningDocumentRefs: [...draft.planningDocumentRefs, ref] })
    }

    return (
        <>
            {draft.planningDocumentRefs.length > 0 ? (
                <ul className="modalPlanningDocRefsList" aria-label="Selected documents">
                    {draft.planningDocumentRefs.map((r) => (
                        <li key={r.id} className="modalPlanningDocRefRow">
                            <span className="modalPlanningDocRefName" title={r.name}>
                                {r.name}
                            </span>
                            <button
                                type="button"
                                className="btn modalPlanningDocRefRemove"
                                aria-label={`Remove ${r.name}`}
                                onClick={() =>
                                    patchDraft({
                                        planningDocumentRefs: draft.planningDocumentRefs.filter((x) => x.id !== r.id),
                                    })
                                }
                            >
                                Remove
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="muted modalParentTaskEmpty">No documents linked.</p>
            )}
            <SelectControl
                className="modalPlanningDocRefSelect"
                value=""
                placeholder={addable.length === 0 ? 'No more documents' : 'Add document…'}
                resetAfterChange
                options={addable.map((n) => ({ value: n.id, label: n.name }))}
                onChange={(v) => {
                    if (!v) return
                    onPick(v)
                }}
                disabled={addable.length === 0 || draft.planningDocumentRefs.length >= MAX_TASK_PLANNING_DOC_REFS}
                aria-label="Add planning document"
            />
        </>
    )
}

function TaskModalSubtasksContent({
    directSubtasks,
    onOpenSubtask,
}: {
    directSubtasks: Task[]
    onOpenSubtask?: (task: Task) => void
}) {
    return (
        <div className="modalTaskSubtasksBelowParent">
            <div className="modalSubtasksHeading">Subtasks</div>
            {directSubtasks.length === 0 ? (
                <p className="modalSubtasksEmpty muted">No subtasks for this task.</p>
            ) : (
                <ul className="modalSubtasksList">
                    {directSubtasks.map((st) => (
                        <li key={st.id}>
                            <button type="button" className="modalSubtaskRowBtn" onClick={() => onOpenSubtask?.(st)}>
                                <span className="modalSubtaskTitle">{st.title || 'Untitled'}</span>
                                <span className="modalSubtaskStatus muted">{statusLabel(st.status as TaskStatus)}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

export type TaskModalProps = {
    modal: TaskModalState
    state: UiState
    archivedOnly: boolean
    gameId: string
    features: Feature[]
    categories: Category[]
    allTags: Tag[]
    tasks: Task[]
    canSubmitDraft: (d: TaskDraft) => boolean
    onOpenSubtask?: (task: Task) => void
    closeModal: () => void
    toggleTaskSurface: () => void
    cancelEditToView: () => void
    patchDraft: (patch: Partial<TaskDraft>) => void
    onModalFeatureChange: (featureId: string) => void
    toggleDraftTagId: (tagId: string) => void
    onCreate: () => void | Promise<void>
    onCreateAndAddSubtask: () => void | Promise<void>
    onStartCreateSubtask: () => void
    onSaveTask: () => void | Promise<void>
    onArchiveTask: () => void | Promise<void>
    featureNameById: (id: string) => string
    categoryNameById: (id: string) => string
}

export function TaskModal(props: TaskModalProps) {
    const {
        modal,
        state,
        archivedOnly,
        gameId,
        features,
        categories,
        allTags,
        tasks,
        canSubmitDraft,
        onOpenSubtask,
        closeModal,
        toggleTaskSurface,
        cancelEditToView,
        patchDraft,
        onModalFeatureChange,
        toggleDraftTagId,
        onCreate,
        onCreateAndAddSubtask,
        onStartCreateSubtask,
        onSaveTask,
        onArchiveTask,
        featureNameById,
        categoryNameById,
    } = props

    const directSubtasks = useMemo(() => {
        if (modal.kind !== 'task') return []
        return tasks.filter((t) => String(t.parentTaskId ?? '') === modal.taskId)
    }, [tasks, modal])

    const activeDirectSubtasks = useMemo(() => directSubtasks.filter((t) => t.archived !== true), [directSubtasks])

    const statusLockedBySubtasks = modal.kind === 'task' && modal.surface === 'edit' && activeDirectSubtasks.length > 0

    const [planningNodeList, setPlanningNodeList] = useState<PlanningNodeMeta[]>([])
    const planningFetchKey =
        modal.kind === 'closed'
            ? ''
            : modal.kind === 'create'
              ? `c:${gameId}`
              : modal.kind === 'task' && modal.surface === 'edit'
                ? `e:${gameId}:${modal.taskId}`
                : ''

    useEffect(() => {
        if (!planningFetchKey) {
            return
        }
        let cancelled = false
        void listPlanningNodes(gameId)
            .then((list) => {
                if (!cancelled) setPlanningNodeList(list)
            })
            .catch(() => {
                if (!cancelled) setPlanningNodeList([])
            })
        return () => {
            cancelled = true
        }
    }, [gameId, planningFetchKey])

    const planningNodesForPicker = planningFetchKey ? planningNodeList : []

    const viewParentId = modal.kind === 'task' && modal.surface === 'view' ? modal.draft.parentTaskId.trim() : ''
    const viewParentTask = viewParentId ? tasks.find((t) => t.id === viewParentId) : undefined

    if (modal.kind === 'closed') return null

    const featureFieldLocked = modal.draft.parentTaskId.trim().length > 0

    return createPortal(
        <div className="modalBackdrop" onClick={closeModal} role="presentation">
            <div
                className="modalCard modalCardTask"
                role="dialog"
                aria-modal="true"
                aria-labelledby="task-modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modalTaskHeader">
                    {modal.kind === 'create' ? (
                        <h3 className="modalTitle" id="task-modal-title">
                            Create task
                        </h3>
                    ) : null}
                    {modal.kind === 'task' && modal.surface === 'view' ? (
                        <h3 className="modalTitle modalTaskTitleHeader" id="task-modal-title">
                            {modal.draft.title.trim() ? modal.draft.title : 'Untitled task'}
                        </h3>
                    ) : null}
                    {modal.kind === 'task' && modal.surface === 'edit' ? (
                        <input
                            id="task-modal-title"
                            className="textInput modalTaskTitleInput"
                            value={modal.draft.title}
                            placeholder="Title"
                            aria-label="Task title"
                            onChange={(e) => patchDraft({ title: e.target.value })}
                        />
                    ) : null}
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
                                        <SelectControl
                                            id="task-modal-feature"
                                            value={modal.draft.featureId}
                                            onChange={onModalFeatureChange}
                                            options={features.map((f) => ({ value: f.id, label: f.name }))}
                                            disabled={features.length === 0 || featureFieldLocked}
                                            aria-describedby={
                                                featureFieldLocked ? 'task-modal-feature-hint' : undefined
                                            }
                                        />
                                        {featureFieldLocked ? (
                                            <span
                                                id="task-modal-feature-hint"
                                                className="muted"
                                                style={{ fontSize: 12, display: 'block', marginTop: 4 }}
                                            >
                                                Inherited from parent task
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="modalMetaCell">
                                        <label className="modalFieldLabel" htmlFor="task-modal-category">
                                            Category
                                        </label>
                                        <SelectControl
                                            id="task-modal-category"
                                            value={modal.draft.categoryId}
                                            onChange={(v) => patchDraft({ categoryId: v })}
                                            options={[
                                                { value: '', label: 'None' },
                                                ...categories.map((c) => ({ value: c.id, label: c.name })),
                                            ]}
                                        />
                                    </div>
                                    <div className="modalMetaCell">
                                        <label className="modalFieldLabel" htmlFor="task-modal-status">
                                            Status
                                        </label>
                                        <SelectControl
                                            id="task-modal-status"
                                            value={modal.draft.status}
                                            onChange={(v) => patchDraft({ status: v as TaskStatus })}
                                            options={TASK_STATUS_OPTIONS}
                                        />
                                    </div>
                                </div>
                                <div className="modalTaskParentSplit modalTaskParentSplitCreate">
                                    <div className="modalTaskParentSplitTop">
                                        <label className="modalFieldLabel" htmlFor="task-modal-parent">
                                            Parent task (optional)
                                        </label>
                                        <SelectControl
                                            id="task-modal-parent"
                                            value={modal.draft.parentTaskId}
                                            onChange={(v) => patchDraft({ parentTaskId: v })}
                                            options={[
                                                { value: '', label: 'None (root task)' },
                                                ...parentTaskPickerOptions(tasks, modal.draft.featureId, null).map(
                                                    (pt) => ({ value: pt.id, label: pt.title })
                                                ),
                                            ]}
                                            aria-label="Parent task"
                                        />
                                    </div>
                                    <div className="modalTaskParentSplitBottom">
                                        <span className="modalFieldLabel">Document references</span>
                                        <TaskPlanningDocRefsEditable
                                            draft={modal.draft}
                                            patchDraft={patchDraft}
                                            planningNodeList={planningNodesForPicker}
                                        />
                                    </div>
                                </div>
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
                                            const col = normalizeHex6(tg.color, FALLBACK_FEATURE_COLOR)
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
                        <div className="modalFooter modalFooterTask">
                            <div className="modalFooterStart" />
                            <div className="modalFooterEnd">
                                <button type="button" className="btn btnDanger" onClick={closeModal}>
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn"
                                    disabled={!canSubmitDraft(modal.draft) || state.kind === 'loading'}
                                    onClick={() => void onCreateAndAddSubtask()}
                                >
                                    Create &amp; add subtask
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
                        </div>
                    </>
                )}

                {modal.kind === 'task' && modal.surface === 'view' && (
                    <>
                        <div className="modalTaskColumns">
                            <section className="modalTaskMainPane" aria-label="Task details">
                                <div className="modalTaskScroll">
                                    <div className="modalTaskViewBody">
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
                                                            const tc = normalizeHex6(tg?.color, FALLBACK_FEATURE_COLOR)
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
                            </section>
                            <aside className="modalTaskSubtasksPane" aria-label="Parent task and subtasks">
                                <div className="modalTaskParentSplit">
                                    <div className="modalTaskParentSplitTop modalTaskParentSection">
                                        <span className="modalFieldLabel">Parent task</span>
                                        {viewParentId.length === 0 ? (
                                            <p className="muted modalParentTaskEmpty">No Parent Task</p>
                                        ) : (
                                            <ul className="modalSubtasksList modalParentTaskRowList">
                                                <li>
                                                    <button
                                                        type="button"
                                                        className="modalSubtaskRowBtn"
                                                        onClick={() =>
                                                            viewParentTask && onOpenSubtask?.(viewParentTask)
                                                        }
                                                        disabled={!viewParentTask}
                                                        aria-label={
                                                            viewParentTask
                                                                ? `Open parent task: ${viewParentTask.title || 'Untitled'}`
                                                                : `Parent task unavailable (${viewParentId})`
                                                        }
                                                    >
                                                        <span className="modalSubtaskTitle">
                                                            {viewParentTask?.title ?? viewParentId}
                                                        </span>
                                                        <span className="modalSubtaskStatus muted">
                                                            {viewParentTask
                                                                ? statusLabel(viewParentTask.status as TaskStatus)
                                                                : '—'}
                                                        </span>
                                                    </button>
                                                </li>
                                            </ul>
                                        )}
                                    </div>
                                    <div className="modalTaskParentSplitBottom">
                                        <span className="modalFieldLabel">Document references</span>
                                        <TaskPlanningDocRefsReadonly
                                            refs={modal.draft.planningDocumentRefs}
                                            gameId={gameId}
                                            closeModal={closeModal}
                                        />
                                    </div>
                                </div>
                                <TaskModalSubtasksContent
                                    directSubtasks={directSubtasks}
                                    onOpenSubtask={onOpenSubtask}
                                />
                            </aside>
                        </div>
                        <div className="modalFooter modalFooterTask">
                            <div
                                className="modalFooterStart"
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 8,
                                    alignItems: 'center',
                                }}
                            >
                                <button
                                    type="button"
                                    className="btn"
                                    disabled={state.kind === 'loading'}
                                    onClick={() => void onArchiveTask()}
                                >
                                    {archivedOnly ? 'Unarchive' : 'Archive'}
                                </button>
                                <button
                                    type="button"
                                    className="btn"
                                    disabled={state.kind === 'loading'}
                                    onClick={onStartCreateSubtask}
                                >
                                    Add subtask
                                </button>
                                {modal.draft.sourceGameExceptionId.trim().length > 0 ? (
                                    <Link
                                        className="btn"
                                        to={`/g/${encodeURIComponent(gameId)}/dashboard?exception=${encodeURIComponent(modal.draft.sourceGameExceptionId.trim())}`}
                                        onClick={closeModal}
                                    >
                                        View exception in dashboard
                                    </Link>
                                ) : null}
                            </div>
                            <div className="modalFooterEnd">
                                <button type="button" className="btn btnDanger" onClick={closeModal}>
                                    Cancel
                                </button>
                                <button type="button" className="btn btnPrimary" onClick={toggleTaskSurface}>
                                    Edit
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {modal.kind === 'task' && modal.surface === 'edit' && (
                    <>
                        <div className="modalTaskColumns">
                            <section className="modalTaskMainPane" aria-label="Edit task">
                                <div className="modalTaskScroll">
                                    <div className="modalFormGrid modalTaskEditForm">
                                        <div className="modalMetaRow">
                                            <div className="modalMetaCell">
                                                <label className="modalFieldLabel" htmlFor="task-edit-feature">
                                                    Feature
                                                </label>
                                                <SelectControl
                                                    id="task-edit-feature"
                                                    value={modal.draft.featureId}
                                                    onChange={onModalFeatureChange}
                                                    options={features.map((f) => ({ value: f.id, label: f.name }))}
                                                    disabled={featureFieldLocked}
                                                    aria-describedby={
                                                        featureFieldLocked ? 'task-edit-feature-hint' : undefined
                                                    }
                                                />
                                                {featureFieldLocked ? (
                                                    <span
                                                        id="task-edit-feature-hint"
                                                        className="muted"
                                                        style={{ fontSize: 12, display: 'block', marginTop: 4 }}
                                                    >
                                                        Inherited from parent task
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div className="modalMetaCell">
                                                <label className="modalFieldLabel" htmlFor="task-edit-category">
                                                    Category
                                                </label>
                                                <SelectControl
                                                    id="task-edit-category"
                                                    value={modal.draft.categoryId}
                                                    onChange={(v) => patchDraft({ categoryId: v })}
                                                    options={[
                                                        { value: '', label: 'None' },
                                                        ...categories.map((c) => ({ value: c.id, label: c.name })),
                                                    ]}
                                                />
                                            </div>
                                            <div className="modalMetaCell">
                                                <label className="modalFieldLabel" htmlFor="task-edit-status">
                                                    Status
                                                </label>
                                                <SelectControl
                                                    id="task-edit-status"
                                                    value={modal.draft.status}
                                                    disabled={statusLockedBySubtasks}
                                                    aria-describedby={
                                                        statusLockedBySubtasks ? 'task-edit-status-hint' : undefined
                                                    }
                                                    onChange={(v) => patchDraft({ status: v as TaskStatus })}
                                                    options={TASK_STATUS_OPTIONS}
                                                />
                                                {statusLockedBySubtasks ? (
                                                    <p id="task-edit-status-hint" className="muted modalFieldHint">
                                                        Status follows subtasks (lowest active subtask status).
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>
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
                                                    const col = normalizeHex6(tg.color, FALLBACK_FEATURE_COLOR)
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
                            </section>
                            <aside className="modalTaskSubtasksPane" aria-label="Parent task and subtasks">
                                <div className="modalTaskParentSplit">
                                    <div className="modalTaskParentSplitTop modalTaskParentSection">
                                        <label className="modalFieldLabel" htmlFor="task-edit-parent">
                                            Parent task
                                        </label>
                                        <SelectControl
                                            id="task-edit-parent"
                                            value={modal.draft.parentTaskId}
                                            onChange={(v) => patchDraft({ parentTaskId: v })}
                                            options={[
                                                { value: '', label: 'None (root task)' },
                                                ...parentTaskPickerOptions(
                                                    tasks,
                                                    modal.draft.featureId,
                                                    modal.taskId
                                                ).map((pt) => ({ value: pt.id, label: pt.title })),
                                            ]}
                                            aria-label="Parent task"
                                        />
                                    </div>
                                    <div className="modalTaskParentSplitBottom">
                                        <span className="modalFieldLabel">Document references</span>
                                        <TaskPlanningDocRefsEditable
                                            draft={modal.draft}
                                            patchDraft={patchDraft}
                                            planningNodeList={planningNodesForPicker}
                                        />
                                    </div>
                                </div>
                                <TaskModalSubtasksContent
                                    directSubtasks={directSubtasks}
                                    onOpenSubtask={onOpenSubtask}
                                />
                            </aside>
                        </div>
                        <div className="modalFooter modalFooterTask">
                            <div
                                className="modalFooterStart"
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 8,
                                    alignItems: 'center',
                                }}
                            >
                                <button
                                    type="button"
                                    className="btn"
                                    disabled={state.kind === 'loading'}
                                    onClick={() => void onArchiveTask()}
                                >
                                    {archivedOnly ? 'Unarchive' : 'Archive'}
                                </button>
                                <button
                                    type="button"
                                    className="btn"
                                    disabled={state.kind === 'loading'}
                                    onClick={onStartCreateSubtask}
                                >
                                    Add subtask
                                </button>
                                {modal.draft.sourceGameExceptionId.trim().length > 0 ? (
                                    <Link
                                        className="btn"
                                        to={`/g/${encodeURIComponent(gameId)}/dashboard?exception=${encodeURIComponent(modal.draft.sourceGameExceptionId.trim())}`}
                                        onClick={closeModal}
                                    >
                                        View exception in dashboard
                                    </Link>
                                ) : null}
                            </div>
                            <div className="modalFooterEnd">
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
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    )
}
