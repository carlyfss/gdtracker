import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { GameEvent, GameEventDefinition } from '../api/gameEvents'
import { listGameEventDefinitions, listGameEvents } from '../api/gameEvents'
import { getLocationHeatmap } from '../api/trace'
import { useGameId } from '../context/GameIdContext'
import { DEFAULT_ACCENT_HEX } from '../theme/defaults'
import {
    CartesianGrid,
    Cell,
    Customized,
    ResponsiveContainer,
    Scatter,
    ScatterChart,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

import type { GameEventTraceEntry } from '../api/trace'

type VecPoint = {
    id: string
    map: string
    rawLocation: string
    x: number
    z: number
    gameEventId?: string | null
    renderedMessage?: string | null
    definitionCode?: string | null
    definitionColor?: string | null
}

type HeatCell = {
    id: string
    map: string
    count: number
    x: number
    z: number
    x0: number
    x1: number
    z0: number
    z1: number
    /** When exactly one distinct valid `definitionColor` appears in the bin; else `'default'`. */
    binFill: 'default' | 'event'
    eventHex?: string
}

const numberPattern = /[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n))
}

function parseGodotLocationToXZ(raw: string): { x: number; z: number } | null {
    const matches = raw.match(numberPattern)
    if (!matches || matches.length < 3) return null
    const x = Number(matches[0])
    const z = Number(matches[2])
    if (!(Number.isFinite(x) && Number.isFinite(z))) return null
    return { x, z }
}

function formatNumber(n: number) {
    if (!Number.isFinite(n)) return ''
    const abs = Math.abs(n)
    if (abs >= 1000) return n.toFixed(0)
    if (abs >= 100) return n.toFixed(1)
    if (abs >= 10) return n.toFixed(2)
    return n.toFixed(3)
}

const DEFAULT_EVENT_COLOR = DEFAULT_ACCENT_HEX

const RANGE_STEP = 25
const RANGE_DEFAULT_MIN = -100
const RANGE_DEFAULT_MAX = 100

function validHexColor(c: string | null | undefined): string | null {
    if (!c) return null
    return /^#[0-9A-Fa-f]{6}$/i.test(c) ? c.toLowerCase() : null
}

function tracePointFill(definitionColor: string | null | undefined): string {
    return validHexColor(definitionColor) ?? DEFAULT_EVENT_COLOR
}

function eventRowColor(e: GameEvent) {
    return validHexColor(e.definitionColor) ?? DEFAULT_EVENT_COLOR
}

/** Applies definition hex color as a translucent row wash so text stays readable. */
function hexToRgba(hex: string, alpha: number): string {
    const normalized = hex.startsWith('#') ? hex.slice(1) : hex
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
        return `rgba(129, 140, 248, ${alpha})`
    }
    const n = Number.parseInt(normalized, 16)
    const r = (n >> 16) & 255
    const g = (n >> 8) & 255
    const b = n & 255
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const EVENT_TABLE_FONT_PX = 14
const EVENT_ROW_BG_ALPHA = 0.22

type HeatmapTooltipPayload = ReadonlyArray<{ payload?: HeatCell | VecPoint }> | undefined

function HeatmapTooltip({ active, payload }: { active?: boolean; payload?: HeatmapTooltipPayload }) {
    if (!active || !payload || payload.length === 0) return null
    // Prefer the raw-point payload (has rawLocation) over the transparent cell scatter (has count),
    // since the raw points are the user-recognizable hover target with event context.
    const point = payload.find((p) => p.payload && 'rawLocation' in p.payload)?.payload as VecPoint | undefined
    const cell = payload.find((p) => p.payload && 'count' in p.payload)?.payload as HeatCell | undefined
    const datum = point ?? cell
    if (!datum) return null

    const containerStyle: CSSProperties = {
        border: '1px solid var(--border)',
        background: 'var(--panel)',
        boxShadow: 'var(--shadow)',
        color: 'var(--text-h)',
        padding: '8px 10px',
        borderRadius: 4,
        fontSize: 13,
        lineHeight: 1.4,
        maxWidth: 320,
    }

    if ('rawLocation' in datum) {
        const messageColor = validHexColor(datum.definitionColor) ?? DEFAULT_EVENT_COLOR
        return (
            <div style={containerStyle}>
                <div>Location {datum.rawLocation}</div>
                {datum.renderedMessage ? (
                    <div style={{ color: messageColor, marginTop: 4 }}>{datum.renderedMessage}</div>
                ) : null}
            </div>
        )
    }

    return (
        <div style={containerStyle}>
            <div>Count: {datum.count}</div>
        </div>
    )
}

export function HeatmapPage() {
    const gameId = useGameId()
    const [heatmapData, setHeatmapData] = useState<GameEventTraceEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedMap, setSelectedMap] = useState<string>('__all__')
    const [heatmapEventCodeFilter, setHeatmapEventCodeFilter] = useState<string>('__all__')
    const [rangeXMin, setRangeXMin] = useState<number>(RANGE_DEFAULT_MIN)
    const [rangeXMax, setRangeXMax] = useState<number>(RANGE_DEFAULT_MAX)
    const [rangeYMin, setRangeYMin] = useState<number>(RANGE_DEFAULT_MIN)
    const [rangeYMax, setRangeYMax] = useState<number>(RANGE_DEFAULT_MAX)

    const [gameEvents, setGameEvents] = useState<GameEvent[]>([])
    const [eventsLoading, setEventsLoading] = useState(true)
    const [eventsError, setEventsError] = useState<string | null>(null)
    const [eventSearchInput, setEventSearchInput] = useState('')
    const [eventSearchDebounced, setEventSearchDebounced] = useState('')
    const [eventCodeFilter, setEventCodeFilter] = useState<string>('__all__')
    const [eventDefinitions, setEventDefinitions] = useState<GameEventDefinition[]>([])

    const eventDefinitionCodes = useMemo(
        () => eventDefinitions.map((d) => d.code).sort((a, b) => a.localeCompare(b)),
        [eventDefinitions]
    )

    const heatmapEventDefinitionsSorted = useMemo(
        () => [...eventDefinitions].sort((a, b) => a.code.localeCompare(b.code)),
        [eventDefinitions]
    )

    useEffect(() => {
        const t = window.setTimeout(() => setEventSearchDebounced(eventSearchInput.trim()), 300)
        return () => window.clearTimeout(t)
    }, [eventSearchInput])

    useEffect(() => {
        listGameEventDefinitions(gameId)
            .then((defs) => setEventDefinitions(defs))
            .catch(() => setEventDefinitions([]))
    }, [gameId])

    useEffect(() => {
        let cancelled = false
        void (async () => {
            setEventsLoading(true)
            setEventsError(null)
            try {
                const rows = await listGameEvents(gameId, {
                    q: eventSearchDebounced.length > 0 ? eventSearchDebounced : undefined,
                    code: eventCodeFilter !== '__all__' ? eventCodeFilter : undefined,
                    limit: 200,
                })
                if (!cancelled) setGameEvents(rows)
            } catch {
                if (!cancelled) {
                    setGameEvents([])
                    setEventsError('Failed to load game events.')
                }
            } finally {
                if (!cancelled) setEventsLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [gameId, eventSearchDebounced, eventCodeFilter])

    useEffect(() => {
        getLocationHeatmap(gameId)
            .then((data) => setHeatmapData(data))
            .catch(() => setHeatmapData([]))
            .finally(() => setLoading(false))
    }, [gameId])

    const points: VecPoint[] = useMemo(() => {
        const out: VecPoint[] = []
        for (const item of heatmapData) {
            const id = String(item.id ?? '')
            const map = typeof item.map === 'string' ? item.map : ''
            const rawLocation = typeof item.location === 'string' ? item.location : ''
            const parsed = parseGodotLocationToXZ(rawLocation)
            if (!parsed) continue
            out.push({
                id: id || `${map}:${rawLocation}`,
                map,
                rawLocation,
                x: parsed.x,
                z: parsed.z,
                gameEventId: item.gameEventId ?? null,
                renderedMessage: item.renderedMessage ?? null,
                definitionCode: item.definitionCode ?? null,
                definitionColor: item.definitionColor ?? null,
            })
        }
        return out
    }, [heatmapData])

    const mapOptions = useMemo(() => {
        const unique = new Set<string>()
        for (const p of points) {
            if (p.map.trim().length > 0) unique.add(p.map)
        }
        return Array.from(unique).sort((a, b) => a.localeCompare(b))
    }, [points])

    const effectiveSelectedMap = useMemo(() => {
        if (selectedMap === '__all__') return '__all__'
        if (mapOptions.includes(selectedMap)) return selectedMap
        return '__all__'
    }, [mapOptions, selectedMap])

    const filteredPoints = useMemo(() => {
        return points.filter((p) => {
            if (effectiveSelectedMap !== '__all__' && p.map !== effectiveSelectedMap) return false
            if (heatmapEventCodeFilter === '__all__') return true
            if (heatmapEventCodeFilter === '__none__') return !p.definitionCode
            return p.definitionCode === heatmapEventCodeFilter
        })
    }, [points, effectiveSelectedMap, heatmapEventCodeFilter])

    const { cells, domain, maxCount } = useMemo(() => {
        const binsX = 40
        const binsZ = 40

        if (filteredPoints.length === 0) {
            return {
                cells: [] as HeatCell[],
                domain: null as null | { minX: number; maxX: number; minZ: number; maxZ: number },
                maxCount: 0,
            }
        }

        let minX = Infinity
        let maxX = -Infinity
        let minZ = Infinity
        let maxZ = -Infinity
        for (const p of filteredPoints) {
            minX = Math.min(minX, p.x)
            maxX = Math.max(maxX, p.x)
            minZ = Math.min(minZ, p.z)
            maxZ = Math.max(maxZ, p.z)
        }

        // Avoid zero-range domains (flat lines) so axes + bins behave.
        if (minX === maxX) {
            minX -= 1
            maxX += 1
        }
        if (minZ === maxZ) {
            minZ -= 1
            maxZ += 1
        }

        const dx = (maxX - minX) / binsX
        const dz = (maxZ - minZ) / binsZ

        const counts = new Map<string, number>()
        const colorSets = new Map<string, Set<string>>()
        for (const p of filteredPoints) {
            const bx = clamp(Math.floor((p.x - minX) / dx), 0, binsX - 1)
            const bz = clamp(Math.floor((p.z - minZ) / dz), 0, binsZ - 1)
            const key = `${bx}:${bz}`
            counts.set(key, (counts.get(key) ?? 0) + 1)
            const hex = validHexColor(p.definitionColor)
            if (hex) {
                let set = colorSets.get(key)
                if (!set) {
                    set = new Set()
                    colorSets.set(key, set)
                }
                set.add(hex)
            }
        }

        let max = 0
        const outCells: HeatCell[] = []
        for (const [key, count] of counts.entries()) {
            const [bxStr, bzStr] = key.split(':')
            const bx = Number(bxStr)
            const bz = Number(bzStr)
            if (!(Number.isFinite(bx) && Number.isFinite(bz))) continue

            max = Math.max(max, count)
            const x0 = minX + bx * dx
            const x1 = x0 + dx
            const z0 = minZ + bz * dz
            const z1 = z0 + dz

            const hues = colorSets.get(key)
            const distinct = hues ? hues.size : 0
            const binFill: HeatCell['binFill'] = distinct === 1 ? 'event' : 'default'
            const eventHex = binFill === 'event' && hues ? [...hues][0] : undefined

            outCells.push({
                id: key,
                map: effectiveSelectedMap === '__all__' ? '' : effectiveSelectedMap,
                count,
                x: (x0 + x1) / 2,
                z: (z0 + z1) / 2,
                x0,
                x1,
                z0,
                z1,
                binFill,
                eventHex,
            })
        }

        return {
            cells: outCells,
            domain: { minX, maxX, minZ, maxZ },
            maxCount: max,
        }
    }, [filteredPoints, effectiveSelectedMap])

    const renderCells = useMemo(() => {
        const max = Math.max(1, maxCount)

        return (props: unknown) => {
            const p = props as {
                xAxisMap?: Record<string, { scale?: (v: number) => number }>
                yAxisMap?: Record<string, { scale?: (v: number) => number }>
            }

            const xAxis = p.xAxisMap ? Object.values(p.xAxisMap)[0] : null
            const yAxis = p.yAxisMap ? Object.values(p.yAxisMap)[0] : null
            const xScale = xAxis?.scale
            const yScale = yAxis?.scale
            if (!xScale || !yScale) return null

            return (
                <g>
                    {cells.map((cell) => {
                        if (cell.count <= 0) return null
                        const intensity = Math.log(cell.count + 1) / Math.log(max + 1)

                        // Chart X = location Z; chart Y = location X (increasing X upward).
                        const x0 = xScale(cell.z0)
                        const x1 = xScale(cell.z1)
                        const y0 = yScale(cell.x1)
                        const y1 = yScale(cell.x0)

                        const x = Math.min(x0, x1)
                        const y = Math.min(y0, y1)
                        const w = Math.max(0.5, Math.abs(x1 - x0))
                        const h = Math.max(0.5, Math.abs(y1 - y0))

                        const fill = cell.binFill === 'event' && cell.eventHex ? cell.eventHex : 'var(--accent-2)'

                        return (
                            <rect
                                key={cell.id}
                                x={x}
                                y={y}
                                width={w}
                                height={h}
                                fill={fill}
                                opacity={0.08 + 0.92 * intensity}
                                stroke="none"
                            />
                        )
                    })}
                </g>
            )
        }
    }, [cells, maxCount])

    return (
        <div className="gamePageStack">
            <section className="gamePageSection">
                <div className="cardHeader">
                    <h2 className="cardTitle">Location Heatmap</h2>
                    <select
                        className="intervalSelect"
                        value={effectiveSelectedMap}
                        onChange={(e) => setSelectedMap(e.target.value)}
                        aria-label="Filter by map"
                    >
                        <option value="__all__">All maps</option>
                        {mapOptions.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="cardBody tasksLayout">
                    <aside className="tasksFilterPanel" aria-label="Heatmap filters">
                        <div className="tasksFilterPanelTitle">Filter by event code</div>
                        <div className="tasksFilterList" role="list">
                            <button
                                type="button"
                                className="filterItem"
                                data-active={heatmapEventCodeFilter === '__all__'}
                                onClick={() => setHeatmapEventCodeFilter('__all__')}
                            >
                                <span className="filterItemInner">
                                    <span className="featureSwatch" style={{ backgroundColor: DEFAULT_EVENT_COLOR }} />
                                    <span>All event codes</span>
                                </span>
                            </button>
                            <button
                                type="button"
                                className="filterItem"
                                data-active={heatmapEventCodeFilter === '__none__'}
                                onClick={() => setHeatmapEventCodeFilter('__none__')}
                            >
                                <span className="filterItemInner">
                                    <span
                                        className="featureSwatch"
                                        style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
                                    />
                                    <span>No event code</span>
                                </span>
                            </button>
                            {heatmapEventDefinitionsSorted.map((d) => {
                                const swatch =
                                    d.color && /^#[0-9A-Fa-f]{6}$/i.test(d.color)
                                        ? d.color.toLowerCase()
                                        : DEFAULT_EVENT_COLOR
                                return (
                                    <button
                                        key={d.id}
                                        type="button"
                                        className="filterItem"
                                        data-active={heatmapEventCodeFilter === d.code}
                                        onClick={() => setHeatmapEventCodeFilter(d.code)}
                                    >
                                        <span className="filterItemInner">
                                            <span className="featureSwatch" style={{ backgroundColor: swatch }} />
                                            <span>{d.code}</span>
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                        <div className="tasksFilterPanelTitle" style={{ marginTop: 14 }}>
                            Range (chart X)
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 8,
                                }}
                            >
                                <span className="muted" style={{ fontSize: 12 }}>
                                    Min
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <button
                                        type="button"
                                        className="btn"
                                        onClick={() =>
                                            setRangeXMin((v) => Math.min(rangeXMax - RANGE_STEP, v - RANGE_STEP))
                                        }
                                    >
                                        -25
                                    </button>
                                    <span
                                        style={{
                                            minWidth: 40,
                                            textAlign: 'center',
                                            fontVariantNumeric: 'tabular-nums',
                                        }}
                                    >
                                        {rangeXMin}
                                    </span>
                                    <button
                                        type="button"
                                        className="btn"
                                        disabled={rangeXMin + RANGE_STEP >= rangeXMax}
                                        onClick={() =>
                                            setRangeXMin((v) => Math.min(rangeXMax - RANGE_STEP, v + RANGE_STEP))
                                        }
                                    >
                                        +25
                                    </button>
                                </div>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 8,
                                }}
                            >
                                <span className="muted" style={{ fontSize: 12 }}>
                                    Max
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <button
                                        type="button"
                                        className="btn"
                                        disabled={rangeXMax - RANGE_STEP <= rangeXMin}
                                        onClick={() =>
                                            setRangeXMax((v) => Math.max(rangeXMin + RANGE_STEP, v - RANGE_STEP))
                                        }
                                    >
                                        -25
                                    </button>
                                    <span
                                        style={{
                                            minWidth: 40,
                                            textAlign: 'center',
                                            fontVariantNumeric: 'tabular-nums',
                                        }}
                                    >
                                        {rangeXMax}
                                    </span>
                                    <button
                                        type="button"
                                        className="btn"
                                        onClick={() =>
                                            setRangeXMax((v) => Math.max(rangeXMin + RANGE_STEP, v + RANGE_STEP))
                                        }
                                    >
                                        +25
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="tasksFilterPanelTitle" style={{ marginTop: 14 }}>
                            Range (chart Y)
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 8,
                                }}
                            >
                                <span className="muted" style={{ fontSize: 12 }}>
                                    Min
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <button
                                        type="button"
                                        className="btn"
                                        onClick={() =>
                                            setRangeYMin((v) => Math.min(rangeYMax - RANGE_STEP, v - RANGE_STEP))
                                        }
                                    >
                                        -25
                                    </button>
                                    <span
                                        style={{
                                            minWidth: 40,
                                            textAlign: 'center',
                                            fontVariantNumeric: 'tabular-nums',
                                        }}
                                    >
                                        {rangeYMin}
                                    </span>
                                    <button
                                        type="button"
                                        className="btn"
                                        disabled={rangeYMin + RANGE_STEP >= rangeYMax}
                                        onClick={() =>
                                            setRangeYMin((v) => Math.min(rangeYMax - RANGE_STEP, v + RANGE_STEP))
                                        }
                                    >
                                        +25
                                    </button>
                                </div>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 8,
                                }}
                            >
                                <span className="muted" style={{ fontSize: 12 }}>
                                    Max
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <button
                                        type="button"
                                        className="btn"
                                        disabled={rangeYMax - RANGE_STEP <= rangeYMin}
                                        onClick={() =>
                                            setRangeYMax((v) => Math.max(rangeYMin + RANGE_STEP, v - RANGE_STEP))
                                        }
                                    >
                                        -25
                                    </button>
                                    <span
                                        style={{
                                            minWidth: 40,
                                            textAlign: 'center',
                                            fontVariantNumeric: 'tabular-nums',
                                        }}
                                    >
                                        {rangeYMax}
                                    </span>
                                    <button
                                        type="button"
                                        className="btn"
                                        onClick={() =>
                                            setRangeYMax((v) => Math.max(rangeYMin + RANGE_STEP, v + RANGE_STEP))
                                        }
                                    >
                                        +25
                                    </button>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="btn"
                                onClick={() => {
                                    setRangeXMin(RANGE_DEFAULT_MIN)
                                    setRangeXMax(RANGE_DEFAULT_MAX)
                                    setRangeYMin(RANGE_DEFAULT_MIN)
                                    setRangeYMax(RANGE_DEFAULT_MAX)
                                }}
                            >
                                Reset to -100 / 100
                            </button>
                        </div>
                    </aside>
                    <div>
                        {loading && <div className="emptyState">Loading…</div>}
                        {!loading && points.length === 0 && (
                            <div className="emptyState">No valid vector locations found.</div>
                        )}
                        {!loading && points.length > 0 && filteredPoints.length === 0 && (
                            <div className="emptyState">No points match the selected filters.</div>
                        )}
                        {!loading && filteredPoints.length > 0 && domain && (
                            <div className="chartWrap" style={{ height: '60vh' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <ScatterChart margin={{ top: 16, right: 24, left: 6, bottom: 24 }}>
                                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                                        <XAxis
                                            type="number"
                                            dataKey="z"
                                            domain={[rangeXMin, rangeXMax]}
                                            allowDataOverflow
                                            stroke="var(--text)"
                                            tick={{ fill: 'var(--text)' }}
                                            tickFormatter={formatNumber}
                                        />
                                        <YAxis
                                            type="number"
                                            dataKey="x"
                                            domain={[rangeYMin, rangeYMax]}
                                            allowDataOverflow
                                            stroke="var(--text)"
                                            tick={{ fill: 'var(--text)' }}
                                            tickFormatter={formatNumber}
                                        />
                                        <Tooltip cursor={false} content={<HeatmapTooltip />} />

                                        {/* Heat cells (rendered via customized layer) */}
                                        <Scatter data={cells} fill="transparent" stroke="transparent" />
                                        <Customized component={renderCells} />

                                        {/* Raw points: per-dot fill via Cell (Recharts merges Cell props onto each point; custom shape did not receive data fields reliably in v3). */}
                                        <Scatter
                                            data={filteredPoints}
                                            shape="circle"
                                            fill={DEFAULT_EVENT_COLOR}
                                            fillOpacity={0.35}
                                        >
                                            {filteredPoints.map((p) => (
                                                <Cell key={p.id} fill={tracePointFill(p.definitionColor)} />
                                            ))}
                                        </Scatter>
                                    </ScatterChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section className="gamePageSection">
                <div className="cardHeader">
                    <h2 className="cardTitle">Game events</h2>
                </div>
                <div className="cardBody">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                        <input
                            type="search"
                            className="textInput"
                            placeholder="Search message or code…"
                            value={eventSearchInput}
                            onChange={(e) => setEventSearchInput(e.target.value)}
                            aria-label="Search game events"
                            style={{ minWidth: 200, flex: '1 1 200px' }}
                        />
                        <select
                            className="intervalSelect"
                            value={eventCodeFilter}
                            onChange={(e) => setEventCodeFilter(e.target.value)}
                            aria-label="Filter by event code"
                        >
                            <option value="__all__">All event codes</option>
                            {eventDefinitionCodes.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </div>
                    {eventsError && <div className="banner bannerError">{eventsError}</div>}
                    {eventsLoading && <div className="emptyState">Loading events…</div>}
                    {!eventsLoading && gameEvents.length === 0 && !eventsError && (
                        <div className="emptyState">No game events match your filters.</div>
                    )}
                    {!eventsLoading && gameEvents.length > 0 && (
                        <div className="tableWrap">
                            <table className="table tableCompact">
                                <thead>
                                    <tr>
                                        <th style={{ width: 160, fontSize: EVENT_TABLE_FONT_PX }}>Time</th>
                                        <th style={{ width: 120, fontSize: EVENT_TABLE_FONT_PX }}>Code</th>
                                        <th style={{ fontSize: EVENT_TABLE_FONT_PX }}>Message</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gameEvents.map((ev, idx) => {
                                        const def = eventDefinitions.find((d) => d.id === ev.definitionId)
                                        const iconSrc =
                                            typeof def?.imageData === 'string' && def.imageData.length > 0
                                                ? def.imageData
                                                : null
                                        const rowBg = hexToRgba(eventRowColor(ev), EVENT_ROW_BG_ALPHA)
                                        return (
                                            <tr
                                                key={ev.id}
                                                data-odd={idx % 2 === 1}
                                                style={{
                                                    backgroundColor: rowBg,
                                                    fontSize: EVENT_TABLE_FONT_PX,
                                                }}
                                            >
                                                <td style={{ whiteSpace: 'nowrap' }}>
                                                    {new Date(ev.timestamp).toLocaleString()}
                                                </td>
                                                <td>
                                                    <code>{ev.definitionCode}</code>
                                                </td>
                                                <td title={ev.renderedMessage}>
                                                    <span
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 8,
                                                        }}
                                                    >
                                                        {iconSrc ? (
                                                            <img
                                                                src={iconSrc}
                                                                alt=""
                                                                width={16}
                                                                height={16}
                                                                style={{
                                                                    imageRendering: 'pixelated',
                                                                    flexShrink: 0,
                                                                }}
                                                            />
                                                        ) : null}
                                                        <span>{ev.renderedMessage}</span>
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </section>
        </div>
    )
}
