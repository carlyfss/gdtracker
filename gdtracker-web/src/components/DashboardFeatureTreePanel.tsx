import type { Feature, FeatureTaskProgressRow } from '../api/features'
import type { TaskStatus } from '../api/tasks'
import { DEFAULT_ACCENT_HEX } from '../theme/defaults'
import type { FeatureTreeRow } from '../util/featureTree'
import { normalizeHex6 } from '../util/hexColor'
import { statusLabel } from '../util/taskStatus'

function featureRowColor(f: Feature) {
    return normalizeHex6(f.color, DEFAULT_ACCENT_HEX)
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

function IconArchiveToBox() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M21 8v13H3V8" />
            <path d="M1 3h22v5H1z" />
            <path d="M10 12h4" />
        </svg>
    )
}

export type DashboardFeatureTreePanelProps = {
    heading: string
    features: Feature[]
    featureListRows: FeatureTreeRow[]
    featuresError: string | null
    featuresPanelLoading: boolean
    progressError: string | null
    progressLoading: boolean
    progressById: Map<string, FeatureTaskProgressRow>
    listShowSubfeatures: boolean
    onListShowSubfeaturesChange: (show: boolean) => void
    collapsedFeatureIds: ReadonlySet<string>
    onToggleFeatureCollapsed: (featureId: string) => void
    onOpenFeature: (f: Feature) => void
    onArchiveFeature?: (f: Feature) => void
    emptyStateMessage?: string
}

export function DashboardFeatureTreePanel({
    heading,
    features,
    featureListRows,
    featuresError,
    featuresPanelLoading,
    progressError,
    progressLoading,
    progressById,
    listShowSubfeatures,
    onListShowSubfeaturesChange,
    collapsedFeatureIds,
    onToggleFeatureCollapsed,
    onOpenFeature,
    onArchiveFeature,
    emptyStateMessage = 'No features yet. Add some under Configuration.',
}: DashboardFeatureTreePanelProps) {
    return (
        <div className="dashboardFeaturesPanel" aria-label={heading}>
            <h3 className="dashboardSubheading">{heading}</h3>
            {featuresError && <div className="banner bannerError">{featuresError}</div>}
            {progressError && !featuresError && (
                <div className="banner bannerError" role="status">
                    {progressError}
                </div>
            )}
            {featuresPanelLoading && <div className="emptyState">Loading features…</div>}
            {!featuresPanelLoading && features.length === 0 && !featuresError && (
                <div className="emptyState">{emptyStateMessage}</div>
            )}
            {!featuresPanelLoading && features.length > 0 && (
                <>
                    <div className="tasksListToolbar dashboardFeatureTreeToolbar">
                        <label htmlFor="dashboard-subfeatures-visibility" className="tasksListToolbarLabel">
                            Subfeatures
                        </label>
                        <select
                            id="dashboard-subfeatures-visibility"
                            className="intervalSelect tasksListToolbarSelect"
                            value={listShowSubfeatures ? 'show' : 'hide'}
                            onChange={(e) => onListShowSubfeaturesChange(e.target.value === 'show')}
                            aria-label="Show or hide subfeatures in the feature list"
                        >
                            <option value="show">Show subfeatures</option>
                            <option value="hide">Hide subfeatures</option>
                        </select>
                    </div>
                    <div className="featureTreeList" role="list">
                        {featureListRows.map((row) => {
                            const f = row.feature
                            const fc = featureRowColor(f)
                            const prog = progressById.get(f.id)
                            let rolledPctLabel: string
                            let directLabel: string
                            if (progressLoading) {
                                rolledPctLabel = '…'
                                directLabel = '…'
                            } else if (progressError) {
                                rolledPctLabel = '—'
                                directLabel = '—'
                            } else {
                                const rolledPct =
                                    prog && prog.rolledUpTotal > 0
                                        ? Math.round((100 * prog.rolledUpDone) / prog.rolledUpTotal)
                                        : 0
                                rolledPctLabel = `${rolledPct}%`
                                directLabel = prog != null ? `${prog.doneDirect}/${prog.totalDirect}` : '0/0'
                            }
                            const rowExpanded = row.hasChildren && !collapsedFeatureIds.has(f.id)
                            return (
                                <div key={f.id} className="featureTreeRow">
                                    <div className="featureTreeRowInner" style={{ paddingLeft: 10 + row.depth * 14 }}>
                                        {row.hasChildren && listShowSubfeatures ? (
                                            <button
                                                type="button"
                                                className="iconBtn tasksTaskTreeToggle"
                                                title={rowExpanded ? 'Hide subfeatures' : 'Show subfeatures'}
                                                aria-expanded={rowExpanded}
                                                aria-label={
                                                    rowExpanded
                                                        ? `Collapse subfeatures for ${f.name}`
                                                        : `Expand subfeatures for ${f.name}`
                                                }
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onToggleFeatureCollapsed(f.id)
                                                }}
                                            >
                                                <IconChevronTaskTree expanded={rowExpanded} />
                                            </button>
                                        ) : (
                                            <span className="tasksTaskTreeSpacer" aria-hidden />
                                        )}
                                        <div
                                            className="featureTreeRowMain"
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => onOpenFeature(f)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault()
                                                    onOpenFeature(f)
                                                }
                                            }}
                                        >
                                            <span className="featureTreeName" style={{ color: fc }}>
                                                {f.name}
                                            </span>
                                            <span className="featureTreeMeta">
                                                <span title="Rolled-up completion across this node and descendants">
                                                    {rolledPctLabel}
                                                </span>
                                                <span
                                                    className="muted"
                                                    title="Tasks directly on this feature (done/total)"
                                                >
                                                    {directLabel}
                                                </span>
                                                <span
                                                    className="tasksStatusPill featureTreeStatusPill"
                                                    data-status={(f.status ?? 'TODO') as TaskStatus}
                                                    title="Feature status"
                                                >
                                                    {statusLabel((f.status ?? 'TODO') as TaskStatus)}
                                                </span>
                                            </span>
                                        </div>
                                        {onArchiveFeature ? (
                                            <button
                                                type="button"
                                                className="iconBtn"
                                                title="Archive feature and subfeatures"
                                                aria-label={`Archive feature ${f.name}`}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onArchiveFeature(f)
                                                }}
                                            >
                                                <IconArchiveToBox />
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </>
            )}
        </div>
    )
}
