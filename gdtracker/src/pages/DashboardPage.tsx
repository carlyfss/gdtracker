import { useCallback, useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FeatureTasksModal } from '../components/FeatureTasksModal'
import type { Feature } from '../api/features'
import { listFeatureTaskProgress, listFeatures, type FeatureTaskProgressRow } from '../api/features'
import { listGameExceptions, listGameExceptionsInterval, type GameException } from '../api/gameExceptions'
import { useGameId } from '../context/GameIdContext'
import { DEFAULT_ACCENT_HEX } from '../theme/defaults'
import { flattenFeaturesForList } from '../util/featureTree'

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

function exceptionTimeFor(item: GameException): Date | null {
    const raw = item.timestamp ?? item.createdAt
    if (raw == null) return null
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) return null
    return date
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

function titleForException(ex: GameException) {
    const msg =
        typeof ex.errorMessage === 'string' && ex.errorMessage.trim().length > 0 ? ex.errorMessage : 'Unknown error'
    return msg
}

function subtitleForException(ex: GameException) {
    const parts: string[] = []
    const t = exceptionTimeFor(ex)
    if (t) parts.push(t.toLocaleString())
    if (typeof ex.map === 'string' && ex.map) parts.push(ex.map)
    if (typeof ex.location === 'string' && ex.location) parts.push(ex.location)
    return parts.join(' • ')
}

function featureRowColor(f: Feature) {
    const c = f.color
    if (c && /^#[0-9A-Fa-f]{6}$/i.test(c)) return c.toLowerCase()
    return DEFAULT_ACCENT_HEX
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

export function DashboardPage() {
    const gameId = useGameId()
    const [exceptions, setExceptions] = useState<GameException[]>([])
    const [loading, setLoading] = useState(true)
    const [exceptionBucket, setExceptionBucket] = useState<TimeBucket>('minute')
    const [selectedBucketStartMs, setSelectedBucketStartMs] = useState<number | null>(null)
    const [selectedIntervalExceptions, setSelectedIntervalExceptions] = useState<GameException[]>([])
    const [selectedIntervalLoading, setSelectedIntervalLoading] = useState(false)
    const [selectedExceptionId, setSelectedExceptionId] = useState<string | null>(null)

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
                setFeatures(await listFeatures(gameId))
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
            setSelectedExceptionId(null)
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

    const effectiveSelectedExceptionId = useMemo(() => {
        if (selectedIntervalExceptions.length === 0) return null
        if (selectedExceptionId && selectedIntervalExceptions.some((ex) => String(ex.id ?? '') === selectedExceptionId))
            return selectedExceptionId
        const first = selectedIntervalExceptions[0]
        return first?.id ? String(first.id) : null
    }, [selectedIntervalExceptions, selectedExceptionId])

    const selectedException = useMemo(() => {
        if (!effectiveSelectedExceptionId) return null
        return selectedIntervalExceptions.find((ex) => String(ex.id ?? '') === effectiveSelectedExceptionId) ?? null
    }, [selectedIntervalExceptions, effectiveSelectedExceptionId])

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

    return (
        <div className="gamePageStack">
            <section className="gamePageSection">
                <div className="cardHeader">
                    <h2 className="cardTitle">Dashboard</h2>
                </div>

                <div className="cardBody dashboardSplit">
                    <div className="dashboardFeaturesPanel" aria-label="Features and task progress">
                        <h3 className="dashboardSubheading">Features</h3>
                        {featuresError && <div className="banner bannerError">{featuresError}</div>}
                        {progressError && !featuresError && (
                            <div className="banner bannerError" role="status">
                                {progressError}
                            </div>
                        )}
                        {featuresPanelLoading && <div className="emptyState">Loading features…</div>}
                        {!featuresPanelLoading && features.length === 0 && !featuresError && (
                            <div className="emptyState">No features yet. Add some under Configuration.</div>
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
                                        onChange={(e) => setListShowSubfeatures(e.target.value === 'show')}
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
                                            directLabel =
                                                prog != null ? `${prog.doneDirect}/${prog.totalDirect}` : '0/0'
                                        }
                                        const rowExpanded = row.hasChildren && !collapsedFeatureIds.has(f.id)
                                        return (
                                            <div key={f.id} className="featureTreeRow">
                                                <div
                                                    className="featureTreeRowInner"
                                                    style={{ paddingLeft: 10 + row.depth * 14 }}
                                                >
                                                    {row.hasChildren && listShowSubfeatures ? (
                                                        <button
                                                            type="button"
                                                            className="iconBtn tasksTaskTreeToggle"
                                                            title={
                                                                rowExpanded ? 'Hide subfeatures' : 'Show subfeatures'
                                                            }
                                                            aria-expanded={rowExpanded}
                                                            aria-label={
                                                                rowExpanded
                                                                    ? `Collapse subfeatures for ${f.name}`
                                                                    : `Expand subfeatures for ${f.name}`
                                                            }
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                toggleFeatureRowCollapsed(f.id)
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
                                                        onClick={() => setFeatureModal(f)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault()
                                                                setFeatureModal(f)
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
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="dashboardExceptionsStack">
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

                        <div className="dashboardExceptionsInnerSplit">
                            <div className="splitLeft chartWrap">
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

                            <div className="splitRight dashboardExceptionBucketList">
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
                                            const active =
                                                effectiveSelectedExceptionId != null &&
                                                id === effectiveSelectedExceptionId
                                            return (
                                                <button
                                                    key={id || subtitleForException(ex)}
                                                    type="button"
                                                    className="exceptionListItem"
                                                    data-active={active}
                                                    onClick={() => setSelectedExceptionId(id || null)}
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

                        <div className="dashboardExceptionDetail cardLikeInset">
                            <div className="splitPanelHeader" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                                <div className="splitPanelTitle">Exception detail</div>
                            </div>
                            {!selectedException && (
                                <div className="emptyState" style={{ padding: '8px 4px' }}>
                                    Select a chart point and an exception to view details.
                                </div>
                            )}
                            {selectedException && (
                                <div className="exceptionDetail">
                                    <div className="exceptionDetailTitle">{titleForException(selectedException)}</div>
                                    <div className="exceptionDetailSubtitle">
                                        {subtitleForException(selectedException)}
                                    </div>
                                    <pre className="stackTrace">
                                        {typeof selectedException.stackTrace === 'string' &&
                                        selectedException.stackTrace.trim().length > 0
                                            ? selectedException.stackTrace
                                            : 'No stack trace'}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <FeatureTasksModal
                open={featureModal != null}
                onClose={() => setFeatureModal(null)}
                gameId={gameId}
                feature={featureModal}
                progress={modalProgress}
            />
        </div>
    )
}
