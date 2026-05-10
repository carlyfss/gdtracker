import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import type { Category } from '../../../api/categories'
import type { Feature } from '../../../api/features'
import type { Tag } from '../../../api/tags'
import type { Task, TaskStatus } from '../../../api/tasks'
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

export type TaskModalProps = {
    modal: TaskModalState
    state: UiState
    archivedOnly: boolean
    gameId: string
    features: Feature[]
    categories: Category[]
    allTags: Tag[]
    tasks: Task[]
    modalTitleText: string
    canSubmitDraft: (d: TaskDraft) => boolean
    closeModal: () => void
    toggleTaskSurface: () => void
    cancelEditToView: () => void
    patchDraft: (patch: Partial<TaskDraft>) => void
    toggleDraftTagId: (tagId: string) => void
    onCreate: () => void | Promise<void>
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
        modalTitleText,
        canSubmitDraft,
        closeModal,
        toggleTaskSurface,
        cancelEditToView,
        patchDraft,
        toggleDraftTagId,
        onCreate,
        onSaveTask,
        onArchiveTask,
        featureNameById,
        categoryNameById,
    } = props

    if (modal.kind === 'closed') return null

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
                                            onChange={(e) => patchDraft({ status: e.target.value as TaskStatus })}
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
                                    {parentTaskPickerOptions(tasks, modal.draft.featureId, null).map((pt) => (
                                        <option key={pt.id} value={pt.id}>
                                            {pt.title}
                                        </option>
                                    ))}
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
                                            ? (tasks.find((x) => x.id === modal.draft.parentTaskId)?.title ??
                                              modal.draft.parentTaskId)
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
                                        <div className="modalReadonlyValue">{statusLabel(modal.draft.status)}</div>
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
                                            onChange={(e) => patchDraft({ status: e.target.value as TaskStatus })}
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
                                    {parentTaskPickerOptions(tasks, modal.draft.featureId, modal.taskId).map((pt) => (
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
