import { Link } from 'react-router-dom'
import type { Category } from '../../../api/categories'
import type { Feature } from '../../../api/features'
import type { Tag } from '../../../api/tags'
import type { TaskStatus } from '../../../api/tasks'
import { chipTextColor } from '../../../util/chipTextColor'
import { normalizeHex6 } from '../../../util/hexColor'
import { allStatus, statusLabel } from '../../../util/taskStatus'
import { FALLBACK_FEATURE_COLOR, type UiState } from '../tasksPageUtils'

export type TasksFilterPanelProps = {
    gameId: string
    archivedOnly: boolean
    state: UiState
    features: Feature[]
    categories: Category[]
    allTags: Tag[]
    selectedFeatureId: string
    setSelectedFeatureId: (v: string) => void
    selectedCategoryId: string
    setSelectedCategoryId: (v: string) => void
    selectedFilterTagIds: string[]
    toggleFilterTagId: (id: string) => void
    tagFilterMode: 'ANY' | 'ALL'
    setTagFilterMode: (v: 'ANY' | 'ALL') => void
    selectedStatus: TaskStatus | '__all__'
    setSelectedStatus: (v: TaskStatus | '__all__') => void
    openCreateModal: () => void
}

export function TasksFilterPanel({
    gameId,
    archivedOnly,
    state,
    features,
    categories,
    allTags,
    selectedFeatureId,
    setSelectedFeatureId,
    selectedCategoryId,
    setSelectedCategoryId,
    selectedFilterTagIds,
    toggleFilterTagId,
    tagFilterMode,
    setTagFilterMode,
    selectedStatus,
    setSelectedStatus,
    openCreateModal,
}: TasksFilterPanelProps) {
    return (
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
                            <span className="featureSwatch" style={{ backgroundColor: FALLBACK_FEATURE_COLOR }} />
                            <span>All features</span>
                        </span>
                    </button>
                    {features.map((f) => {
                        const c = normalizeHex6(f.color, FALLBACK_FEATURE_COLOR)
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
                            <span className="featureSwatch" style={{ backgroundColor: FALLBACK_FEATURE_COLOR }} />
                            <span>All categories</span>
                        </span>
                    </button>
                    {categories.map((cat) => {
                        const col = normalizeHex6(cat.color, FALLBACK_FEATURE_COLOR)
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
                        const col = normalizeHex6(tg.color, FALLBACK_FEATURE_COLOR)
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

            {!archivedOnly && (
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
            )}
        </aside>
    )
}
