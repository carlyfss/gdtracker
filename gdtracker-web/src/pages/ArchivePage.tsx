import { useEffect, useMemo, useRef, useState } from 'react'
import { DashboardFeatureTreePanel } from '../components/DashboardFeatureTreePanel'
import { FeatureTasksModal } from '../components/FeatureTasksModal'
import type { Feature } from '../api/features'
import { listFeatureTaskProgress, listFeatures, type FeatureTaskProgressRow } from '../api/features'
import { useGameId } from '../context/GameIdContext'
import { readArchiveFilters, writeArchiveFilters } from '../util/screenFilterPreferences'
import { flattenFeaturesForList } from '../util/featureTree'
import { TasksPageBody } from './TasksPage'

export function ArchivePage() {
    const gameId = useGameId()

    const [features, setFeatures] = useState<Feature[]>([])
    const [featureProgress, setFeatureProgress] = useState<FeatureTaskProgressRow[]>([])
    const [featuresPanelLoading, setFeaturesPanelLoading] = useState(true)
    const [progressLoading, setProgressLoading] = useState(true)
    const [featuresError, setFeaturesError] = useState<string | null>(null)
    const [progressError, setProgressError] = useState<string | null>(null)
    const [featureModal, setFeatureModal] = useState<Feature | null>(null)
    const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null)
    const [listShowSubfeatures, setListShowSubfeatures] = useState(true)
    const [collapsedFeatureIds, setCollapsedFeatureIds] = useState<Set<string>>(() => new Set())

    const skipPersistArchiveFilters = useRef(true)

    useEffect(() => {
        void (async () => {
            setFeaturesPanelLoading(true)
            setFeaturesError(null)
            try {
                const loaded = await listFeatures(gameId, { archived: true })
                setFeatures(loaded)
                const featureIds = loaded.map((f) => f.id)
                const stored = readArchiveFilters(gameId, featureIds)
                if (stored?.selectedFeatureId && featureIds.includes(stored.selectedFeatureId)) {
                    setSelectedFeatureId(stored.selectedFeatureId)
                } else {
                    setSelectedFeatureId((prev) => prev ?? loaded[0]?.id ?? null)
                }
                if (stored) {
                    setListShowSubfeatures(stored.listShowSubfeatures)
                    setCollapsedFeatureIds(new Set(stored.collapsedFeatureIds))
                }
            } catch {
                setFeatures([])
                setFeaturesError('Failed to load archived features.')
                setSelectedFeatureId(null)
            } finally {
                setFeaturesPanelLoading(false)
            }
        })()
        void (async () => {
            setProgressLoading(true)
            setProgressError(null)
            try {
                setFeatureProgress(await listFeatureTaskProgress(gameId, { archived: true }))
            } catch {
                setFeatureProgress([])
                setProgressError('Could not load task progress. Stats may be incomplete.')
            } finally {
                setProgressLoading(false)
            }
        })()
    }, [gameId])

    useEffect(() => {
        if (skipPersistArchiveFilters.current) {
            skipPersistArchiveFilters.current = false
            return
        }
        const timer = window.setTimeout(() => {
            writeArchiveFilters(gameId, {
                selectedFeatureId,
                listShowSubfeatures,
                collapsedFeatureIds: [...collapsedFeatureIds],
            })
        }, 300)
        return () => window.clearTimeout(timer)
    }, [gameId, selectedFeatureId, listShowSubfeatures, collapsedFeatureIds])

    const progressById = useMemo(() => {
        const m = new Map<string, FeatureTaskProgressRow>()
        for (const r of featureProgress) m.set(r.featureId, r)
        return m
    }, [featureProgress])

    const featureListRows = useMemo(
        () =>
            flattenFeaturesForList(features, {
                showSubfeatures: listShowSubfeatures,
                collapsedParentIds: collapsedFeatureIds,
            }),
        [features, listShowSubfeatures, collapsedFeatureIds]
    )

    const toggleFeatureRowCollapsed = (featureId: string) => {
        setCollapsedFeatureIds((prev) => {
            const next = new Set(prev)
            if (next.has(featureId)) next.delete(featureId)
            else next.add(featureId)
            return next
        })
    }

    const modalProgress = useMemo(() => {
        if (!featureModal) return null
        const p = progressById.get(featureModal.id)
        if (!p) return null
        return { done: p.rolledUpDone, total: p.rolledUpTotal }
    }, [featureModal, progressById])

    return (
        <div className="gamePageStack">
            <section className="gamePageSection">
                <div className="cardHeader">
                    <h2 className="cardTitle">Archive</h2>
                    <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
                        Archived features and tasks are only listed here.
                    </p>
                </div>

                <div className="cardBody dashboardSplit">
                    <DashboardFeatureTreePanel
                        heading="Archived features"
                        features={features}
                        featureListRows={featureListRows}
                        featuresError={featuresError}
                        featuresPanelLoading={featuresPanelLoading}
                        progressError={progressError}
                        progressLoading={progressLoading}
                        progressById={progressById}
                        listShowSubfeatures={listShowSubfeatures}
                        onListShowSubfeaturesChange={setListShowSubfeatures}
                        collapsedFeatureIds={collapsedFeatureIds}
                        onToggleFeatureCollapsed={toggleFeatureRowCollapsed}
                        onOpenFeature={(f) => {
                            setSelectedFeatureId(f.id)
                            setFeatureModal(f)
                        }}
                        emptyStateMessage="No archived features yet. Archive from the Dashboard or Tasks page."
                    />

                    <div className="dashboardFeaturesPanel dashboardArchiveTasksPanel" aria-label="Archived tasks">
                        <h3 className="dashboardSubheading" style={{ marginBottom: 10 }}>
                            Archived tasks
                        </h3>
                        <TasksPageBody
                            gameId={gameId}
                            archivedOnly
                            layout="embedded"
                            forcedFeatureId={selectedFeatureId}
                        />
                    </div>
                </div>
            </section>

            <FeatureTasksModal
                open={featureModal != null}
                onClose={() => setFeatureModal(null)}
                gameId={gameId}
                feature={featureModal}
                progress={modalProgress}
                taskListScope="archived"
                onAfterArchiveOrUnarchive={async () => {
                    try {
                        const loaded = await listFeatures(gameId, { archived: true })
                        setFeatures(loaded)
                        setSelectedFeatureId((prev) => {
                            if (prev && loaded.some((f) => f.id === prev)) return prev
                            return loaded[0]?.id ?? null
                        })
                    } catch {
                        setFeatures([])
                        setSelectedFeatureId(null)
                    }
                }}
            />
        </div>
    )
}
