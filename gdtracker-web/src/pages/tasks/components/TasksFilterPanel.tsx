import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Category } from '../../../api/categories'
import type { Feature } from '../../../api/features'
import type { Tag } from '../../../api/tags'
import type { TaskStatus } from '../../../api/tasks'
import { FilterPillAddGroup, type FilterPillItem } from '../../../components/FilterPillAddGroup'
import { SelectControl } from '../../../components/SelectControl'
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
    filteredCountLabel: string
    listShownLabel: string
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
    filteredCountLabel,
    listShownLabel,
}: TasksFilterPanelProps) {
    const featureSelected = useMemo((): FilterPillItem[] => {
        if (selectedFeatureId === '__all__') return []
        const f = features.find((x) => x.id === selectedFeatureId)
        if (!f) return []
        return [
            {
                value: f.id,
                label: f.name,
                swatchColor: normalizeHex6(f.color, FALLBACK_FEATURE_COLOR),
            },
        ]
    }, [features, selectedFeatureId])

    const featureAddOptions = useMemo((): FilterPillItem[] => {
        const byId = features
            .filter((f) => f.id !== selectedFeatureId)
            .map((f) => ({
                value: f.id,
                label: f.name,
                swatchColor: normalizeHex6(f.color, FALLBACK_FEATURE_COLOR),
            }))
        if (selectedFeatureId !== '__all__') {
            return [{ value: '__all__', label: 'All features', swatchColor: FALLBACK_FEATURE_COLOR }, ...byId]
        }
        return byId
    }, [features, selectedFeatureId])

    const categorySelected = useMemo((): FilterPillItem[] => {
        if (selectedCategoryId === '__all__') return []
        const c = categories.find((x) => x.id === selectedCategoryId)
        if (!c) return []
        return [
            {
                value: c.id,
                label: c.name,
                swatchColor: normalizeHex6(c.color, FALLBACK_FEATURE_COLOR),
            },
        ]
    }, [categories, selectedCategoryId])

    const categoryAddOptions = useMemo((): FilterPillItem[] => {
        const byId = categories
            .filter((c) => c.id !== selectedCategoryId)
            .map((c) => ({
                value: c.id,
                label: c.name,
                swatchColor: normalizeHex6(c.color, FALLBACK_FEATURE_COLOR),
            }))
        if (selectedCategoryId !== '__all__') {
            return [{ value: '__all__', label: 'All categories', swatchColor: FALLBACK_FEATURE_COLOR }, ...byId]
        }
        return byId
    }, [categories, selectedCategoryId])

    const statusSelected = useMemo((): FilterPillItem[] => {
        if (selectedStatus === '__all__') return []
        return [{ value: selectedStatus, label: statusLabel(selectedStatus) }]
    }, [selectedStatus])

    const statusAddOptions = useMemo((): FilterPillItem[] => {
        if (selectedStatus === '__all__') {
            return allStatus.map((s) => ({ value: s, label: statusLabel(s) }))
        }
        const rows: FilterPillItem[] = [{ value: '__all__', label: 'All statuses' }]
        for (const s of allStatus) {
            if (s !== selectedStatus) rows.push({ value: s, label: statusLabel(s) })
        }
        return rows
    }, [selectedStatus])

    const tagSelected = useMemo((): FilterPillItem[] => {
        const out: FilterPillItem[] = []
        for (const id of selectedFilterTagIds) {
            const tg = allTags.find((t) => t.id === id)
            if (!tg) continue
            out.push({
                value: tg.id,
                label: `#${tg.name}`,
                swatchColor: normalizeHex6(tg.color, FALLBACK_FEATURE_COLOR),
            })
        }
        return out
    }, [allTags, selectedFilterTagIds])

    const tagAddOptions = useMemo((): FilterPillItem[] => {
        return allTags
            .filter((tg) => !selectedFilterTagIds.includes(tg.id))
            .map((tg) => ({
                value: tg.id,
                label: `#${tg.name}`,
                swatchColor: normalizeHex6(tg.color, FALLBACK_FEATURE_COLOR),
            }))
    }, [allTags, selectedFilterTagIds])

    return (
        <aside className="tasksFilterPanel" aria-label="Task filters">
            {features.length === 0 ? (
                <>
                    <div className="tasksFilterPanelTitle">Filter by feature</div>
                    <div className="emptyState">
                        No features yet. Create one on the{' '}
                        <Link to={`/g/${encodeURIComponent(gameId)}/configuration`}>Configuration</Link> page.
                    </div>
                </>
            ) : (
                <FilterPillAddGroup
                    title="Filter by feature"
                    selected={featureSelected}
                    onRemove={() => setSelectedFeatureId('__all__')}
                    addOptions={featureAddOptions}
                    onAdd={(v) => setSelectedFeatureId(v)}
                    addPlaceholder="Add feature filter…"
                    ariaLabel="Task feature filters"
                />
            )}

            {categories.length === 0 ? (
                <>
                    <div className="tasksFilterPanelTitle">Filter by category</div>
                    <div className="emptyState">
                        No categories yet. Create one on the{' '}
                        <Link to={`/g/${encodeURIComponent(gameId)}/configuration`}>Configuration</Link> page.
                    </div>
                </>
            ) : (
                <FilterPillAddGroup
                    title="Filter by category"
                    selected={categorySelected}
                    onRemove={() => setSelectedCategoryId('__all__')}
                    addOptions={categoryAddOptions}
                    onAdd={(v) => setSelectedCategoryId(v)}
                    addPlaceholder="Add category filter…"
                    ariaLabel="Task category filters"
                />
            )}

            <FilterPillAddGroup
                title="Status"
                selected={statusSelected}
                onRemove={() => setSelectedStatus('__all__')}
                addOptions={statusAddOptions}
                onAdd={(v) => setSelectedStatus(v as TaskStatus | '__all__')}
                addPlaceholder="Add status filter…"
                ariaLabel="Task status filters"
            />

            <div className="tasksFilterPanelTitle">Filter by tag</div>
            {allTags.length === 0 && (
                <div className="emptyState" style={{ fontSize: 13 }}>
                    No tags yet. Create tags on the{' '}
                    <Link to={`/g/${encodeURIComponent(gameId)}/configuration`}>Configuration</Link> page.
                </div>
            )}
            {allTags.length >= 2 && selectedFilterTagIds.length >= 2 && (
                <div className="tasksFilterMatchRow">
                    <label className="tasksFilterPanelTitle" htmlFor="tasks-tag-filter-mode">
                        Match
                    </label>
                    <SelectControl
                        id="tasks-tag-filter-mode"
                        value={tagFilterMode}
                        onChange={(v) => setTagFilterMode(v as 'ANY' | 'ALL')}
                        options={[
                            { value: 'ANY', label: 'Any selected tag' },
                            { value: 'ALL', label: 'All selected tags' },
                        ]}
                        aria-label="Match any or all selected tags"
                    />
                </div>
            )}
            {allTags.length > 0 && (
                <FilterPillAddGroup
                    title=""
                    selected={tagSelected}
                    onRemove={(id) => toggleFilterTagId(id)}
                    addOptions={tagAddOptions}
                    onAdd={(id) => toggleFilterTagId(id)}
                    addPlaceholder="Add tag filter…"
                    ariaLabel="Task tag filters"
                />
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

            <p className="tasksFilterPanelSummary muted" aria-live="polite">
                {filteredCountLabel}
                <span className="tasksFilterPanelSummarySep" aria-hidden>
                    {' '}
                    ·{' '}
                </span>
                {listShownLabel}
            </p>
        </aside>
    )
}
