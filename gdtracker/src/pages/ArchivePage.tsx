import { useEffect, useMemo, useState } from 'react'
import { DashboardFeatureTreePanel } from '../components/DashboardFeatureTreePanel'
import { FeatureTasksModal } from '../components/FeatureTasksModal'
import type { Feature } from '../api/features'
import { listFeatureTaskProgress, listFeatures, type FeatureTaskProgressRow } from '../api/features'
import { useGameId } from '../context/GameIdContext'
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
    const [listShowSubfeatures, setListShowSubfeatures] = useState(true)
    const [collapsedFeatureIds, setCollapsedFeatureIds] = useState<Set<string>>(() => new Set())

    useEffect(() => {
        void (async () => {
            setFeaturesPanelLoading(true)
            setFeaturesError(null)
            try {
                setFeatures(await listFeatures(gameId, { archived: true }))
            } catch {
                setFeatures([])
                setFeaturesError('Failed to load archived features.')
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
                        onOpenFeature={setFeatureModal}
                        emptyStateMessage="No archived features yet. Archive from the Dashboard or Tasks page."
                    />

                    <div className="dashboardExceptionsStack" style={{ minWidth: 0 }}>
                        <h3 className="dashboardSubheading">Archived tasks</h3>
                        <TasksPageBody gameId={gameId} archivedOnly layout="embedded" />
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
            />
        </div>
    )
}
