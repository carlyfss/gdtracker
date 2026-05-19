import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DashboardFeatureTreePanel } from '../components/DashboardFeatureTreePanel'
import { FeatureTasksModal } from '../components/FeatureTasksModal'
import type { Feature } from '../api/features'
import { listFeatureTaskProgress, listFeatures, type FeatureTaskProgressRow } from '../api/features'
import { getConfiguration } from '../api/configuration'
import {
    getGameException,
    listGameExceptions,
    listGameExceptionsInterval,
    reserveExceptionTaskIndex,
    type GameException,
} from '../api/gameExceptions'
import { listTasks, type Task } from '../api/tasks'
import { useGameId } from '../context/GameIdContext'
import { readDashboardFilters, writeDashboardFilters } from '../util/screenFilterPreferences'
import { flattenFeaturesForList } from '../util/featureTree'
import { applyExceptionTaskDescriptionTemplate, applyExceptionTaskTitleTemplate } from '../util/exceptionTaskTemplate'
import { ExceptionDetailPanel } from './dashboard/components/ExceptionDetailPanel'
import { ExceptionSearchPanel } from './dashboard/components/ExceptionSearchPanel'
import { exceptionTimeFor, subtitleForException, titleForException } from './dashboard/dashboardPageUtils'

type TimeBucket = 'minute' | 'halfHour' | 'hour' | 'day'

type ExceptionSeriesPoint = {
    bucket: string
    count: number
    bucketStartMs: number
}

function pad2(n: number) {
    return String(n).padStart(2, '0')
}

function formatDateYmd(d: Date) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function formatTimeHm(d: Date) {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function bucketStartFor(date: Date, bucket: TimeBucket) {
    const y = date.getFullYear()
    const m = date.getMonth()
    const d = date.getDate()
    const h = date.getHours()
    const min = date.getMinutes()

    if (bucket === 'day') return new Date(y, m, d, 0, 0, 0, 0)
    if (bucket === 'hour') return new Date(y, m, d, h, 0, 0, 0)
    if (bucket === 'halfHour') return new Date(y, m, d, h, min < 30 ? 0 : 30, 0, 0)
    return new Date(y, m, d, h, min, 0, 0)
}

function bucketEndFor(start: Date, bucket: TimeBucket) {
    const end = new Date(start)
    if (bucket === 'day') end.setDate(end.getDate() + 1)
    else if (bucket === 'hour') end.setHours(end.getHours() + 1)
    else if (bucket === 'halfHour') end.setMinutes(end.getMinutes() + 30)
    else end.setMinutes(end.getMinutes() + 1)
    return end
}

function bucketLabelFor(start: Date, bucket: TimeBucket) {
    if (bucket === 'day') return formatDateYmd(start)
    return `${formatDateYmd(start)} ${formatTimeHm(start)}`
}

function bucketLabel(bucket: TimeBucket) {
    switch (bucket) {
        case 'minute':
            return 'Per Minute'
        case 'halfHour':
            return 'Per 30 Minutes'
        case 'hour':
            return 'Hourly'
        case 'day':
            return 'Per Day'
        default:
            return 'Hourly'
    }
}

export function DashboardPage() {
    const gameId = useGameId()
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const [exceptions, setExceptions] = useState<GameException[]>([])
    const [loading, setLoading] = useState(true)
    const [exceptionBucket, setExceptionBucket] = useState<TimeBucket>('minute')
    const [selectedBucketStartMs, setSelectedBucketStartMs] = useState<number | null>(null)
    const [selectedIntervalExceptions, setSelectedIntervalExceptions] = useState<GameException[]>([])
    const [selectedIntervalLoading, setSelectedIntervalLoading] = useState(false)
    const [pickedException, setPickedException] = useState<GameException | null>(null)

    const [features, setFeatures] = useState<Feature[]>([])
    const [featureProgress, setFeatureProgress] = useState<FeatureTaskProgressRow[]>([])
    const [featuresPanelLoading, setFeaturesPanelLoading] = useState(true)
    const [progressLoading, setProgressLoading] = useState(true)
    const [featuresError, setFeaturesError] = useState<string | null>(null)
    const [progressError, setProgressError] = useState<string | null>(null)
    const [featureModal, setFeatureModal] = useState<Feature | null>(null)
    const [listShowSubfeatures, setListShowSubfeatures] = useState(true)
    const [collapsedFeatureIds, setCollapsedFeatureIds] = useState<Set<string>>(() => new Set())
    const skipPersistDashboardFilters = useRef(true)
    const [exceptionDeepLinkError, setExceptionDeepLinkError] = useState<string | null>(null)
    const [createTaskFromExceptionBusy, setCreateTaskFromExceptionBusy] = useState(false)
    const [linkedExceptionTaskId, setLinkedExceptionTaskId] = useState<string | null>(null)

    const exceptionQueryId = searchParams.get('exception')?.trim() ?? ''

    useEffect(() => {
        if (!exceptionQueryId) return
        let cancelled = false
        const timer = window.setTimeout(() => {
            void (async () => {
                if (cancelled) return
                setExceptionDeepLinkError(null)
                try {
                    const ex = await getGameException(gameId, exceptionQueryId)
                    if (cancelled) return
                    const t = exceptionTimeFor(ex)
                    if (t) {
                        const start = bucketStartFor(t, exceptionBucket)
                        setSelectedBucketStartMs(start.getTime())
                    }
                    setPickedException(ex)
                    setSearchParams(
                        (prev) => {
                            const next = new URLSearchParams(prev)
                            next.delete('exception')
                            return next
                        },
                        { replace: true }
                    )
                } catch {
                    if (!cancelled) {
                        setExceptionDeepLinkError('Could not open that exception. It may have been removed.')
                        setSearchParams(
                            (prev) => {
                                const next = new URLSearchParams(prev)
                                next.delete('exception')
                                return next
                            },
                            { replace: true }
                        )
                    }
                }
            })()
        }, 0)
        return () => {
            cancelled = true
            window.clearTimeout(timer)
        }
    }, [exceptionQueryId, gameId, exceptionBucket, setSearchParams])

    useEffect(() => {
        listGameExceptions(gameId)
            .then((data) => setExceptions(data))
            .catch(() => setExceptions([]))
            .finally(() => setLoading(false))
    }, [gameId])

    useEffect(() => {
        void (async () => {
            setFeaturesPanelLoading(true)
            setFeaturesError(null)
            try {
                const loaded = await listFeatures(gameId)
                setFeatures(loaded)
                const stored = readDashboardFilters(
                    gameId,
                    loaded.map((f) => f.id)
                )
                if (stored) {
                    setExceptionBucket(stored.exceptionBucket)
                    setListShowSubfeatures(stored.listShowSubfeatures)
                    setCollapsedFeatureIds(new Set(stored.collapsedFeatureIds))
                }
            } catch {
                setFeatures([])
                setFeaturesError('Failed to load features.')
            } finally {
                setFeaturesPanelLoading(false)
            }
        })()
        void (async () => {
            setProgressLoading(true)
            setProgressError(null)
            try {
                setFeatureProgress(await listFeatureTaskProgress(gameId))
            } catch {
                setFeatureProgress([])
                setProgressError('Could not load task progress. Stats may be incomplete.')
            } finally {
                setProgressLoading(false)
            }
        })()
    }, [gameId])

    useEffect(() => {
        if (skipPersistDashboardFilters.current) {
            skipPersistDashboardFilters.current = false
            return
        }
        const timer = window.setTimeout(() => {
            writeDashboardFilters(gameId, {
                exceptionBucket,
                listShowSubfeatures,
                collapsedFeatureIds: [...collapsedFeatureIds],
            })
        }, 300)
        return () => window.clearTimeout(timer)
    }, [gameId, exceptionBucket, listShowSubfeatures, collapsedFeatureIds])

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

    const exceptionSeries: ExceptionSeriesPoint[] = useMemo(() => {
        const grouped = new Map<number, number>()
        for (const item of exceptions) {
            const date = exceptionTimeFor(item)
            if (!date) continue
            const start = bucketStartFor(date, exceptionBucket)
            const t = start.getTime()
            grouped.set(t, (grouped.get(t) ?? 0) + 1)
        }

        return Array.from(grouped.entries())
            .sort(([a], [b]) => a - b)
            .map(([t, count]) => ({
                bucket: bucketLabelFor(new Date(t), exceptionBucket),
                count,
                bucketStartMs: t,
            }))
    }, [exceptions, exceptionBucket])

    const effectiveBucketStartMs = useMemo(() => {
        if (exceptionSeries.length === 0) return null
        if (selectedBucketStartMs != null && exceptionSeries.some((p) => p.bucketStartMs === selectedBucketStartMs)) {
            return selectedBucketStartMs
        }
        return exceptionSeries[exceptionSeries.length - 1]?.bucketStartMs ?? null
    }, [exceptionSeries, selectedBucketStartMs])

    const selectBucketStartMs = useCallback(
        (bucketStartMs: number) => {
            if (effectiveBucketStartMs != null && bucketStartMs === effectiveBucketStartMs) return

            setSelectedBucketStartMs(bucketStartMs)
            setPickedException(null)
            setSelectedIntervalLoading(true)
            setSelectedIntervalExceptions([])
        },
        [effectiveBucketStartMs]
    )

    const selectedBucketRange = useMemo(() => {
        if (effectiveBucketStartMs == null) return null
        const idx = exceptionSeries.findIndex((p) => p.bucketStartMs === effectiveBucketStartMs)
        const nextStartMs = idx >= 0 ? (exceptionSeries[idx + 1]?.bucketStartMs ?? null) : null

        const start = new Date(effectiveBucketStartMs)
        const end = nextStartMs != null ? new Date(nextStartMs) : bucketEndFor(start, exceptionBucket)
        return { start, end }
    }, [effectiveBucketStartMs, exceptionSeries, exceptionBucket])

    useEffect(() => {
        if (!selectedBucketRange) return

        const fromMs = selectedBucketRange.start.getTime()
        const toMs = selectedBucketRange.end.getTime()
        if (!(Number.isFinite(fromMs) && Number.isFinite(toMs)) || fromMs >= toMs) return

        listGameExceptionsInterval(gameId, fromMs, toMs)
            .then((data) => setSelectedIntervalExceptions(data))
            .catch(() => setSelectedIntervalExceptions([]))
            .finally(() => setSelectedIntervalLoading(false))
    }, [selectedBucketRange, gameId])

    const selectedException = useMemo<GameException | null>(() => {
        if (pickedException) return pickedException
        return selectedIntervalExceptions[0] ?? null
    }, [pickedException, selectedIntervalExceptions])

    const selectedExceptionId = selectedException?.id ? String(selectedException.id) : null

    useEffect(() => {
        if (!selectedExceptionId) {
            const clearTimer = window.setTimeout(() => setLinkedExceptionTaskId(null), 0)
            return () => window.clearTimeout(clearTimer)
        }
        let cancelled = false
        void listTasks(gameId, { sourceGameExceptionId: selectedExceptionId })
            .then((tasks: Task[]) => {
                if (cancelled) return
                const sorted = [...tasks].sort((a, b) => {
                    const ta = a.createdAt ? new Date(a.createdAt).getTime() : Number.POSITIVE_INFINITY
                    const tb = b.createdAt ? new Date(b.createdAt).getTime() : Number.POSITIVE_INFINITY
                    return ta - tb
                })
                window.setTimeout(() => {
                    if (!cancelled) setLinkedExceptionTaskId(sorted[0]?.id ?? null)
                }, 0)
            })
            .catch(() => {
                if (!cancelled) {
                    window.setTimeout(() => setLinkedExceptionTaskId(null), 0)
                }
            })
        return () => {
            cancelled = true
        }
    }, [gameId, selectedExceptionId])

    const selectedBucketLabel = useMemo(() => {
        if (!selectedBucketRange) return null
        const startLabel = bucketLabelFor(selectedBucketRange.start, exceptionBucket)
        const endLabel = bucketLabelFor(selectedBucketRange.end, exceptionBucket)
        return `${startLabel} → ${endLabel}`
    }, [selectedBucketRange, exceptionBucket])

    const modalProgress = useMemo(() => {
        if (!featureModal) return null
        const p = progressById.get(featureModal.id)
        if (!p) return null
        return { done: p.rolledUpDone, total: p.rolledUpTotal }
    }, [featureModal, progressById])

    const onCreateTaskForException = useCallback(async () => {
        if (!selectedException?.id) return
        const exId = String(selectedException.id)
        setCreateTaskFromExceptionBusy(true)
        setExceptionDeepLinkError(null)
        try {
            const idx = await reserveExceptionTaskIndex(gameId, exId)
            const cfg = await getConfiguration(gameId)
            const tpl = cfg.exceptionTaskTemplate
            const titleTpl = tpl?.titleTemplate ?? 'Fix Exception #<EXCEPTION_INDEX>'
            const descTpl = tpl?.descriptionTemplate ?? '```\n<EXCEPTION_TRACE>\n```'
            const trace = typeof selectedException.stackTrace === 'string' ? selectedException.stackTrace : ''
            const errMsg =
                typeof selectedException.errorMessage === 'string' && selectedException.errorMessage.trim().length > 0
                    ? selectedException.errorMessage.trim()
                    : 'Unknown error'
            const shortErr =
                typeof selectedException.shortErrorMessage === 'string'
                    ? selectedException.shortErrorMessage.trim()
                    : ''
            const title = applyExceptionTaskTitleTemplate(titleTpl, {
                exceptionIndex: idx,
                exceptionId: exId,
                errorMessage: errMsg,
                shortErrorMessage: shortErr,
            })
            const description = applyExceptionTaskDescriptionTemplate(descTpl, trace, {
                exceptionId: exId,
                errorMessage: errMsg,
                shortErrorMessage: shortErr,
            })
            const categoryId = tpl?.defaultCategoryId ?? undefined
            navigate(`/g/${encodeURIComponent(gameId)}/tasks`, {
                state: {
                    createFromException: {
                        exceptionId: exId,
                        title,
                        description,
                        ...(categoryId ? { categoryId } : {}),
                    },
                },
            })
        } catch {
            setExceptionDeepLinkError('Could not start task creation. Try again.')
        } finally {
            setCreateTaskFromExceptionBusy(false)
        }
    }, [gameId, navigate, selectedException])

    const onGoToExceptionTask = useCallback(() => {
        if (!linkedExceptionTaskId) return
        navigate(`/g/${encodeURIComponent(gameId)}/tasks?task=${encodeURIComponent(linkedExceptionTaskId)}`)
    }, [gameId, navigate, linkedExceptionTaskId])

    const refreshFeaturePanels = useCallback(async () => {
        setFeaturesPanelLoading(true)
        setFeaturesError(null)
        try {
            setFeatures(await listFeatures(gameId))
        } catch {
            setFeatures([])
            setFeaturesError('Failed to load features.')
        } finally {
            setFeaturesPanelLoading(false)
        }

        setProgressLoading(true)
        setProgressError(null)
        try {
            setFeatureProgress(await listFeatureTaskProgress(gameId))
        } catch {
            setFeatureProgress([])
            setProgressError('Could not load task progress. Stats may be incomplete.')
        } finally {
            setProgressLoading(false)
        }
    }, [gameId])

    return (
        <div className="gamePageStack">
            <section className="gamePageSection">
                <div className="cardHeader">
                    <h2 className="cardTitle">Dashboard</h2>
                </div>

                <div className="cardBody dashboardSplit">
                    <DashboardFeatureTreePanel
                        heading="Features"
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
                    />

                    <div className="dashboardExceptionsStack">
                        {exceptionDeepLinkError && (
                            <div className="banner bannerError" role="status">
                                {exceptionDeepLinkError}
                            </div>
                        )}
                        <div className="dashboardExceptionsToolbar">
                            <h3 className="dashboardSubheading">Exceptions</h3>
                            <select
                                className="intervalSelect"
                                value={exceptionBucket}
                                onChange={(e) => setExceptionBucket(e.target.value as TimeBucket)}
                                aria-label="Exception occurrences interval"
                            >
                                <option value="minute">Per minute</option>
                                <option value="halfHour">Per 30 minutes</option>
                                <option value="hour">Hourly</option>
                                <option value="day">Per day</option>
                            </select>
                        </div>

                        <div className="dashboardExceptionsRightStack">
                            <div className="chartWrap">
                                <ResponsiveContainer width="100%" height={280}>
                                    <LineChart
                                        data={exceptionSeries}
                                        margin={{ top: 16, right: 24, left: 0, bottom: 0 }}
                                        onClick={(state: unknown) => {
                                            const s = state as { activePayload?: Array<{ payload?: unknown }> } | null
                                            const payload = (s?.activePayload?.[0]?.payload ??
                                                null) as ExceptionSeriesPoint | null
                                            if (!payload?.bucketStartMs) return
                                            selectBucketStartMs(payload.bucketStartMs)
                                        }}
                                    >
                                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                                        <XAxis dataKey="bucket" stroke="var(--text)" tick={{ fill: 'var(--text)' }} />
                                        <YAxis
                                            allowDecimals={false}
                                            stroke="var(--text)"
                                            tick={{ fill: 'var(--text)' }}
                                        />
                                        <Tooltip
                                            trigger="click"
                                            contentStyle={{
                                                border: '1px solid var(--border)',
                                                background: 'var(--panel)',
                                                boxShadow: 'var(--shadow)',
                                                color: 'var(--text-h)',
                                            }}
                                            labelStyle={{ color: 'var(--text-h)' }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="count"
                                            stroke="var(--accent-2)"
                                            strokeWidth={2.5}
                                            activeDot={false}
                                            dot={(props) => {
                                                const p = (props?.payload ?? null) as ExceptionSeriesPoint | null
                                                const bucketStartMs = p?.bucketStartMs ?? null
                                                if (!props?.cx || !props?.cy || bucketStartMs == null) return null

                                                const isSelected =
                                                    effectiveBucketStartMs != null &&
                                                    bucketStartMs === effectiveBucketStartMs
                                                const r = isSelected ? 6 : 3.5

                                                return (
                                                    <circle
                                                        cx={props.cx}
                                                        cy={props.cy}
                                                        r={r}
                                                        fill="var(--accent-2)"
                                                        stroke="none"
                                                        strokeWidth={0}
                                                        opacity={isSelected ? 1 : 0.85}
                                                        style={{ cursor: 'pointer' }}
                                                        tabIndex={0}
                                                        onClick={() => selectBucketStartMs(bucketStartMs)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === ' ')
                                                                selectBucketStartMs(bucketStartMs)
                                                        }}
                                                    />
                                                )
                                            }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="dashboardExceptionBucketList">
                                <div className="splitPanelHeader">
                                    <div className="splitPanelTitle">
                                        At selected point ({bucketLabel(exceptionBucket)})
                                    </div>
                                    <div className="splitPanelMeta">
                                        {loading || selectedIntervalLoading
                                            ? 'Loading…'
                                            : (selectedBucketLabel ?? 'Select a point')}
                                    </div>
                                </div>

                                <div className="exceptionList" role="list">
                                    {!loading &&
                                        !selectedIntervalLoading &&
                                        selectedIntervalExceptions.length === 0 && (
                                            <div className="emptyState">No exceptions in this bucket</div>
                                        )}
                                    {(loading || selectedIntervalLoading) && <div className="emptyState">Loading…</div>}
                                    {!loading &&
                                        !selectedIntervalLoading &&
                                        selectedIntervalExceptions.map((ex) => {
                                            const id = String(ex.id ?? '')
                                            const active = selectedExceptionId != null && id === selectedExceptionId
                                            return (
                                                <button
                                                    key={id || subtitleForException(ex)}
                                                    type="button"
                                                    className="exceptionListItem"
                                                    data-active={active}
                                                    onClick={() => setPickedException(ex)}
                                                >
                                                    <div className="exceptionItemTitle">{titleForException(ex)}</div>
                                                    <div className="exceptionItemSubtitle">
                                                        {subtitleForException(ex)}
                                                    </div>
                                                </button>
                                            )
                                        })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="gamePageSection">
                <div className="cardBody dashboardExceptionSearchSection">
                    <ExceptionSearchPanel
                        gameId={gameId}
                        selectedExceptionId={selectedExceptionId}
                        onSelect={setPickedException}
                    />
                    <ExceptionDetailPanel
                        selectedException={selectedException}
                        linkedTaskId={linkedExceptionTaskId}
                        createTaskBusy={createTaskFromExceptionBusy}
                        onCreateTask={() => void onCreateTaskForException()}
                        onGoToTask={onGoToExceptionTask}
                    />
                </div>
            </section>

            <FeatureTasksModal
                open={featureModal != null}
                onClose={() => setFeatureModal(null)}
                gameId={gameId}
                feature={featureModal}
                features={features}
                progress={modalProgress}
                onAfterArchiveOrUnarchive={refreshFeaturePanels}
                onFeatureUpdated={(updated) => {
                    setFeatureModal(updated)
                    setFeatures((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
                }}
            />
        </div>
    )
}
