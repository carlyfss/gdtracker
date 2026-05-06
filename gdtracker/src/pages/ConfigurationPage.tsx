import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Category } from '../api/categories'
import { createCategory, deleteCategory, listCategories, updateCategory } from '../api/categories'
import type { Tag } from '../api/tags'
import { createTag, deleteTag, listTags, updateTag } from '../api/tags'
import { getConfiguration, patchConfiguration } from '../api/configuration'
import type { Feature } from '../api/features'
import { createFeature, deleteFeature, listFeatures, updateFeature } from '../api/features'
import { descendantFeatureIds, depthForFeature, orderedFeatureTree } from '../util/featureTree'
import type { GameEventDefinition } from '../api/gameEvents'
import {
    createGameEventDefinition,
    deleteGameEventDefinition,
    getIngestTokenStatus,
    listGameEventDefinitions,
    regenerateIngestToken,
    updateGameEventDefinition,
} from '../api/gameEvents'
import { useGameId } from '../context/GameIdContext'
import { useGameTheme } from '../context/GameThemeContext'
import { DEFAULT_ACCENT_HEX, parseThemeColorHex } from '../theme/defaults'
import type { TaskStatus } from '../api/tasks'
import { chipTextColor } from '../util/chipTextColor'

type UiState =
    | { kind: 'idle' }
    | { kind: 'loading'; message: string }
    | { kind: 'error'; message: string }
    | { kind: 'success'; message: string }

function normalizeName(raw: string) {
    return raw.trim().replace(/\s+/g, ' ')
}

const DEFAULT_COLOR = DEFAULT_ACCENT_HEX

const allStatus: TaskStatus[] = ['PENDING', 'TODO', 'IN_PROGRESS', 'COMPLETED', 'DONE']

function statusLabel(s: TaskStatus) {
    switch (s) {
        case 'PENDING':
            return 'Pending'
        case 'TODO':
            return 'Todo'
        case 'IN_PROGRESS':
            return 'In Progress'
        case 'COMPLETED':
            return 'Completed'
        case 'DONE':
            return 'Done'
        default:
            return s
    }
}

function isAxiosStatus(err: unknown, status: number) {
    const e = err as { response?: { status?: number } } | null
    return e?.response?.status === status
}

function normalizeHexColor(raw: string): string {
    const t = raw.trim()
    if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t.toLowerCase()
    return DEFAULT_COLOR
}

function IconEdit() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
    )
}

function IconTrash() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
    )
}

function featureRowColor(f: Feature) {
    const c = f.color
    if (c && /^#[0-9A-Fa-f]{6}$/i.test(c)) return c.toLowerCase()
    return DEFAULT_COLOR
}

function featureParentOptionLabel(f: Feature, all: Feature[]): string {
    const d = depthForFeature(f.id, all)
    const indent = d > 0 ? `${'  '.repeat(d)}` : ''
    return `${indent}${f.name}`
}

function categoryRowColor(c: Category) {
    const col = c.color
    if (col && /^#[0-9A-Fa-f]{6}$/i.test(col)) return col.toLowerCase()
    return DEFAULT_COLOR
}

type FlagRow = { id: string; key: string; on: boolean }
type SettingRow = { id: string; key: string; value: string }

const THEME_COLOR_KEY = 'THEME_COLOR'

function upsertSettingKey(rows: SettingRow[], key: string, value: string): SettingRow[] {
    const normalizedKey = key.trim()
    const idx = rows.findIndex((r) => r.key.trim().toLowerCase() === normalizedKey.toLowerCase())
    if (!normalizedKey) return rows
    const trimmed = value.trim()
    if (trimmed === '') {
        if (idx === -1) return rows
        return rows.filter((_, i) => i !== idx)
    }
    if (idx === -1) {
        return [...rows, { id: `s-${Date.now()}-${normalizedKey}`, key: normalizedKey, value: trimmed }]
    }
    return rows.map((r, i) => (i === idx ? { ...r, key: normalizedKey, value: trimmed } : r))
}

function rowsFromFlags(flags: Record<string, boolean>): FlagRow[] {
    return Object.entries(flags).map(([key, on], i) => ({
        id: `f-${i}-${key}`,
        key,
        on: !!on,
    }))
}

function settingValueCell(value: string | number | boolean): string {
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false'
    }
    if (typeof value === 'number') {
        return String(value)
    }
    return value
}

function rowsFromSettings(settings: Record<string, string | number | boolean>): SettingRow[] {
    return Object.entries(settings).map(([key, value], i) => ({
        id: `s-${i}-${key}`,
        key,
        value: settingValueCell(value),
    }))
}

function GameConfigFormSection({ gameId, refreshToken }: { gameId: string; refreshToken: number }) {
    const { refreshTheme } = useGameTheme()
    const [state, setState] = useState<UiState>({ kind: 'idle' })
    const [categories, setCategories] = useState<Category[]>([])
    const [flagRows, setFlagRows] = useState<FlagRow[]>([])
    const [settingRows, setSettingRows] = useState<SettingRow[]>([])
    const [defaultCategoryId, setDefaultCategoryId] = useState<string | null>(null)

    const load = useCallback(async () => {
        setState({ kind: 'loading', message: 'Loading configuration…' })
        try {
            const [cfg, cats] = await Promise.all([getConfiguration(gameId), listCategories(gameId)])
            setCategories(cats)
            setFlagRows(rowsFromFlags(cfg.featureFlags ?? {}))
            setSettingRows(rowsFromSettings(cfg.settings ?? {}))
            setDefaultCategoryId(cfg.defaultExceptionTaskCategoryId ?? null)
            setState({ kind: 'idle' })
        } catch {
            setState({ kind: 'error', message: 'Failed to load configuration.' })
        }
    }, [gameId])

    useEffect(() => {
        const t = window.setTimeout(() => void load(), 0)
        return () => window.clearTimeout(t)
    }, [gameId, refreshToken, load])

    const addFlagRow = () => {
        setFlagRows((r) => [...r, { id: `n-${Date.now()}`, key: '', on: false }])
    }

    const addSettingRow = () => {
        setSettingRows((r) => [...r, { id: `ns-${Date.now()}`, key: '', value: '' }])
    }

    const onSaveConfig = async () => {
        const featureFlags: Record<string, boolean> = {}
        for (const row of flagRows) {
            const k = row.key.trim()
            if (!k) continue
            featureFlags[k] = row.on
        }
        const settings: Record<string, string | number | boolean> = {}
        for (const row of settingRows) {
            const k = row.key.trim()
            if (!k) continue
            const v = row.value.trim()
            if (v === 'true' || v === 'false') {
                settings[k] = v === 'true'
            } else if (v !== '' && !Number.isNaN(Number(v)) && /^-?\d+(\.\d+)?$/.test(v)) {
                settings[k] = Number(v)
            } else {
                settings[k] = v
            }
        }

        setState({ kind: 'loading', message: 'Saving configuration…' })
        try {
            const updated = await patchConfiguration(gameId, {
                featureFlags,
                settings,
                defaultExceptionTaskCategoryId:
                    defaultCategoryId && defaultCategoryId.length > 0 ? defaultCategoryId : null,
            })
            setFlagRows(rowsFromFlags(updated.featureFlags ?? {}))
            setSettingRows(rowsFromSettings(updated.settings ?? {}))
            setDefaultCategoryId(updated.defaultExceptionTaskCategoryId ?? null)
            setState({ kind: 'success', message: 'Configuration saved.' })
            refreshTheme()
        } catch {
            setState({ kind: 'error', message: 'Failed to save configuration.' })
        }
    }

    return (
        <section className="gamePageSection">
            <div className="cardHeader">
                <h2 className="cardTitle">Game configuration</h2>
            </div>
            <div className="cardBody">
                {state.kind === 'error' && <div className="banner bannerError">{state.message}</div>}
                {state.kind === 'success' && <div className="banner bannerSuccess">{state.message}</div>}
                {state.kind === 'loading' && <div className="banner">{state.message}</div>}

                <h3 className="configSubheading">Feature flags</h3>
                <p className="muted" style={{ marginBottom: 12 }}>
                    Boolean switches keyed by name. Empty keys are ignored on save.
                </p>
                <div className="tableWrap" style={{ marginBottom: 20 }}>
                    <table className="table tableCompact">
                        <thead>
                            <tr>
                                <th>Key</th>
                                <th style={{ width: 100 }}>Enabled</th>
                                <th style={{ width: 56 }} />
                            </tr>
                        </thead>
                        <tbody>
                            {flagRows.map((row) => (
                                <tr key={row.id}>
                                    <td>
                                        <input
                                            className="textInput"
                                            value={row.key}
                                            onChange={(e) => {
                                                const v = e.target.value
                                                setFlagRows((rows) =>
                                                    rows.map((x) => (x.id === row.id ? { ...x, key: v } : x))
                                                )
                                            }}
                                            placeholder="flag_key"
                                            aria-label="Feature flag key"
                                        />
                                    </td>
                                    <td>
                                        <label className="inlineCheckbox">
                                            <input
                                                type="checkbox"
                                                checked={row.on}
                                                onChange={(e) => {
                                                    const on = e.target.checked
                                                    setFlagRows((rows) =>
                                                        rows.map((x) => (x.id === row.id ? { ...x, on } : x))
                                                    )
                                                }}
                                            />
                                            <span>On</span>
                                        </label>
                                    </td>
                                    <td>
                                        <button
                                            type="button"
                                            className="iconBtn iconBtnDanger"
                                            title="Remove row"
                                            aria-label="Remove flag row"
                                            onClick={() => setFlagRows((rows) => rows.filter((x) => x.id !== row.id))}
                                        >
                                            <IconTrash />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <button type="button" className="btn" style={{ marginBottom: 24 }} onClick={addFlagRow}>
                    Add flag
                </button>

                <h3 className="configSubheading">Accent color</h3>
                <p className="muted" style={{ marginBottom: 12 }}>
                    Optional UI accent (stored as settings key <code>{THEME_COLOR_KEY}</code>). Use a CSS hex color (
                    <code>#rgb</code> or <code>#rrggbb</code>). Cleared or invalid values fall back to the default
                    Godot-style blue. Applies across this game&apos;s dashboard after save.
                </p>
                <div
                    className="themeColorRow"
                    style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        marginBottom: 24,
                    }}
                >
                    <input
                        type="color"
                        aria-label="Theme accent color"
                        value={
                            parseThemeColorHex(
                                settingRows.find((r) => r.key.trim().toUpperCase() === THEME_COLOR_KEY)?.value ?? ''
                            ) ?? DEFAULT_ACCENT_HEX
                        }
                        onChange={(e) => {
                            const hex = e.target.value
                            setSettingRows((rows) => upsertSettingKey(rows, THEME_COLOR_KEY, hex))
                        }}
                        style={{
                            width: 44,
                            height: 36,
                            padding: 2,
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            background: 'var(--panel)',
                            cursor: 'pointer',
                        }}
                    />
                    <input
                        className="textInput"
                        style={{ maxWidth: 140 }}
                        placeholder="#478cbf"
                        aria-label="Theme color hex value"
                        value={settingRows.find((r) => r.key.trim().toUpperCase() === THEME_COLOR_KEY)?.value ?? ''}
                        onChange={(e) =>
                            setSettingRows((rows) => upsertSettingKey(rows, THEME_COLOR_KEY, e.target.value))
                        }
                    />
                    <button
                        type="button"
                        className="btn"
                        onClick={() =>
                            setSettingRows((rows) => rows.filter((r) => r.key.trim().toUpperCase() !== THEME_COLOR_KEY))
                        }
                    >
                        Clear accent override
                    </button>
                </div>

                <h3 className="configSubheading">Settings</h3>
                <p className="muted" style={{ marginBottom: 12 }}>
                    String values, or numbers, or the words true/false for booleans. <code>{THEME_COLOR_KEY}</code> is
                    controlled above and omitted from the table below.
                </p>
                <div className="tableWrap" style={{ marginBottom: 20 }}>
                    <table className="table tableCompact">
                        <thead>
                            <tr>
                                <th>Key</th>
                                <th>Value</th>
                                <th style={{ width: 56 }} />
                            </tr>
                        </thead>
                        <tbody>
                            {settingRows
                                .filter((row) => row.key.trim().toUpperCase() !== THEME_COLOR_KEY)
                                .map((row) => (
                                    <tr key={row.id}>
                                        <td>
                                            <input
                                                className="textInput"
                                                value={row.key}
                                                onChange={(e) => {
                                                    const v = e.target.value
                                                    setSettingRows((rows) =>
                                                        rows.map((x) => (x.id === row.id ? { ...x, key: v } : x))
                                                    )
                                                }}
                                                placeholder="setting_key"
                                                aria-label="Setting key"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                className="textInput"
                                                value={row.value}
                                                onChange={(e) => {
                                                    const v = e.target.value
                                                    setSettingRows((rows) =>
                                                        rows.map((x) => (x.id === row.id ? { ...x, value: v } : x))
                                                    )
                                                }}
                                                aria-label="Setting value"
                                            />
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="iconBtn iconBtnDanger"
                                                title="Remove row"
                                                aria-label="Remove setting row"
                                                onClick={() =>
                                                    setSettingRows((rows) => rows.filter((x) => x.id !== row.id))
                                                }
                                            >
                                                <IconTrash />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
                <button type="button" className="btn" style={{ marginBottom: 24 }} onClick={addSettingRow}>
                    Add setting
                </button>

                <h3 className="configSubheading">Default category for tasks from game exceptions</h3>
                <p className="muted" style={{ marginBottom: 12 }}>
                    Used when creating tasks from exceptions (upcoming). Clear the selection to leave unset.
                </p>
                <select
                    className="intervalSelect"
                    style={{ maxWidth: 360, marginBottom: 16 }}
                    value={defaultCategoryId ?? ''}
                    onChange={(e) => {
                        const v = e.target.value
                        setDefaultCategoryId(v.length ? v : null)
                    }}
                    aria-label="Default exception task category"
                >
                    <option value="">None</option>
                    {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>

                <div>
                    <button
                        type="button"
                        className="btn btnPrimary"
                        disabled={state.kind === 'loading'}
                        onClick={() => void onSaveConfig()}
                    >
                        Save configuration
                    </button>
                </div>
            </div>
        </section>
    )
}

function GameFeaturesSection({ gameId }: { gameId: string }) {
    const [features, setFeatures] = useState<Feature[]>([])
    const [state, setState] = useState<UiState>({ kind: 'idle' })
    const [createName, setCreateName] = useState('')
    const [createDescription, setCreateDescription] = useState('')
    const [createStatus, setCreateStatus] = useState<TaskStatus>('TODO')
    const [createColor, setCreateColor] = useState(DEFAULT_COLOR)
    const [createParentId, setCreateParentId] = useState('')

    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState('')
    const [editingDescription, setEditingDescription] = useState('')
    const [editingStatus, setEditingStatus] = useState<TaskStatus>('TODO')
    const [editingColor, setEditingColor] = useState(DEFAULT_COLOR)
    const [editingParentId, setEditingParentId] = useState('')

    const orderedFeatures = useMemo(() => orderedFeatureTree(features), [features])

    const editParentBlocklist = useMemo(() => {
        if (!editingId) return new Set<string>()
        const s = new Set<string>([editingId, ...descendantFeatureIds(editingId, features)])
        return s
    }, [editingId, features])

    const refresh = useCallback(async () => {
        setState({ kind: 'loading', message: 'Loading features…' })
        try {
            const data = await listFeatures(gameId)
            setFeatures(data)
            setState({ kind: 'idle' })
        } catch {
            setFeatures([])
            setState({ kind: 'error', message: 'Failed to load features.' })
        }
    }, [gameId])

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void refresh()
        }, 0)
        return () => window.clearTimeout(timer)
    }, [refresh])

    const canCreate = useMemo(() => normalizeName(createName).length > 0, [createName])

    const startEdit = (f: Feature) => {
        setEditingId(f.id)
        setEditingName(f.name)
        setEditingDescription(typeof f.description === 'string' ? f.description : '')
        setEditingStatus((f.status ?? 'TODO') as TaskStatus)
        setEditingColor(featureRowColor(f))
        setEditingParentId(f.parentId ?? '')
        setState({ kind: 'idle' })
    }

    const stopEdit = () => {
        setEditingId(null)
        setEditingName('')
        setEditingDescription('')
        setEditingStatus('TODO')
        setEditingColor(DEFAULT_COLOR)
        setEditingParentId('')
    }

    const onCreate = async () => {
        const name = normalizeName(createName)
        if (!name) return
        setState({ kind: 'loading', message: 'Creating feature…' })
        try {
            await createFeature(gameId, {
                name,
                description: createDescription.trim().length ? createDescription.trim() : null,
                status: createStatus,
                color: normalizeHexColor(createColor),
                parentId: createParentId.trim().length > 0 ? createParentId.trim() : null,
            })
            setCreateName('')
            setCreateDescription('')
            setCreateStatus('TODO')
            setCreateColor(DEFAULT_COLOR)
            setCreateParentId('')
            await refresh()
            setState({ kind: 'success', message: 'Feature created.' })
        } catch (err) {
            const message = isAxiosStatus(err, 409) ? 'Feature name already exists.' : 'Failed to create feature.'
            setState({ kind: 'error', message })
        }
    }

    const onSaveEdit = async () => {
        if (!editingId) return
        const name = normalizeName(editingName)
        if (!name) return
        setState({ kind: 'loading', message: 'Saving…' })
        try {
            await updateFeature(gameId, editingId, {
                name,
                description: editingDescription.trim().length ? editingDescription.trim() : null,
                status: editingStatus,
                color: normalizeHexColor(editingColor),
                parentId: editingParentId.trim().length > 0 ? editingParentId.trim() : null,
            })
            stopEdit()
            await refresh()
            setState({ kind: 'success', message: 'Feature updated.' })
        } catch (err) {
            const message = isAxiosStatus(err, 409) ? 'Feature name already exists.' : 'Failed to update feature.'
            setState({ kind: 'error', message })
        }
    }

    const onDelete = async (f: Feature) => {
        const ok = window.confirm(`Delete feature "${f.name}"?`)
        if (!ok) return

        setState({ kind: 'loading', message: 'Deleting…' })
        try {
            await deleteFeature(gameId, f.id)
            await refresh()
            setState({ kind: 'success', message: 'Feature deleted.' })
        } catch (err) {
            const message = isAxiosStatus(err, 409)
                ? 'Cannot delete: remove subfeatures and tasks first (or reassign tasks).'
                : 'Failed to delete feature.'
            setState({ kind: 'error', message })
        }
    }

    return (
        <section className="gamePageSection">
            <div className="cardHeader">
                <h2 className="cardTitle">Features</h2>
            </div>

            <div className="cardBody">
                {state.kind === 'error' && <div className="banner bannerError">{state.message}</div>}
                {state.kind === 'success' && <div className="banner bannerSuccess">{state.message}</div>}
                {state.kind === 'loading' && <div className="banner">{state.message}</div>}

                <div className="featureCreateGrid" style={{ marginBottom: 16 }}>
                    <input
                        className="textInput"
                        value={createName}
                        placeholder="New feature name"
                        onChange={(e) => setCreateName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') void onCreate()
                        }}
                        aria-label="New feature name"
                    />
                    <input
                        type="color"
                        value={createColor}
                        onChange={(e) => setCreateColor(e.target.value)}
                        title="Feature color"
                        aria-label="Feature color"
                        style={{
                            width: 52,
                            height: 36,
                            padding: 2,
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'var(--panel)',
                        }}
                    />
                    <select
                        className="intervalSelect featureCreateStatus"
                        value={createStatus}
                        onChange={(e) => setCreateStatus(e.target.value as TaskStatus)}
                        aria-label="Feature status"
                    >
                        {allStatus.map((s) => (
                            <option key={s} value={s}>
                                {statusLabel(s)}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        className="btn btnPrimary featureCreateSubmit"
                        disabled={!canCreate || state.kind === 'loading'}
                        onClick={() => void onCreate()}
                    >
                        Add
                    </button>
                    <textarea
                        className="textArea featureCreateDesc"
                        value={createDescription}
                        placeholder="Description (optional)"
                        onChange={(e) => setCreateDescription(e.target.value)}
                        rows={2}
                    />
                    <select
                        className="intervalSelect featureCreateParent"
                        value={createParentId}
                        onChange={(e) => setCreateParentId(e.target.value)}
                        aria-label="Parent feature (optional)"
                    >
                        <option value="">None (root feature)</option>
                        {orderedFeatures.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                                {featureParentOptionLabel(opt, features)}
                            </option>
                        ))}
                    </select>
                </div>

                {features.length === 0 && state.kind !== 'loading' && (
                    <div className="emptyState">No features yet. Add one to start tracking tasks.</div>
                )}

                {features.length > 0 && (
                    <div className="tableWrap">
                        <table className="table tableCompact">
                            <thead>
                                <tr>
                                    <th style={{ width: 36 }} aria-label="Color" />
                                    <th style={{ width: '18%' }}>Name</th>
                                    <th style={{ width: '16%' }}>Parent</th>
                                    <th>Description</th>
                                    <th style={{ width: 120 }}>Status</th>
                                    <th style={{ width: 88 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {orderedFeatures.map((f, idx) => {
                                    const isEditing = editingId === f.id
                                    const fc = featureRowColor(f)
                                    const parentName = f.parentId
                                        ? features.find((x) => x.id === f.parentId)?.name
                                        : null
                                    return (
                                        <tr key={f.id} data-odd={idx % 2 === 1}>
                                            <td>
                                                {isEditing ? (
                                                    <input
                                                        type="color"
                                                        value={
                                                            /^#[0-9A-Fa-f]{6}$/i.test(editingColor)
                                                                ? editingColor
                                                                : DEFAULT_COLOR
                                                        }
                                                        onChange={(e) => setEditingColor(e.target.value)}
                                                        title="Feature color"
                                                        aria-label="Feature color"
                                                        style={{
                                                            width: 36,
                                                            height: 32,
                                                            padding: 0,
                                                            borderRadius: 8,
                                                            border: '1px solid rgba(255,255,255,0.12)',
                                                        }}
                                                    />
                                                ) : (
                                                    <span
                                                        className="featureSwatch"
                                                        style={{ backgroundColor: fc, width: 14, height: 14 }}
                                                    />
                                                )}
                                            </td>
                                            <td>
                                                {isEditing ? (
                                                    <input
                                                        className="textInput"
                                                        value={editingName}
                                                        onChange={(e) => setEditingName(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') void onSaveEdit()
                                                            if (e.key === 'Escape') stopEdit()
                                                        }}
                                                        aria-label={`Edit feature ${f.name}`}
                                                    />
                                                ) : (
                                                    <span style={{ color: fc }}>{f.name}</span>
                                                )}
                                            </td>
                                            <td>
                                                {isEditing ? (
                                                    <select
                                                        className="intervalSelect"
                                                        value={editingParentId}
                                                        onChange={(e) => setEditingParentId(e.target.value)}
                                                        aria-label="Parent feature"
                                                    >
                                                        <option value="">None (root)</option>
                                                        {orderedFeatures
                                                            .filter((opt) => !editParentBlocklist.has(opt.id))
                                                            .map((opt) => (
                                                                <option key={opt.id} value={opt.id}>
                                                                    {featureParentOptionLabel(opt, features)}
                                                                </option>
                                                            ))}
                                                    </select>
                                                ) : parentName ? (
                                                    <span className="muted">{parentName}</span>
                                                ) : (
                                                    <span className="muted">—</span>
                                                )}
                                            </td>
                                            <td style={{ maxWidth: 360 }}>
                                                {isEditing ? (
                                                    <textarea
                                                        className="textArea"
                                                        value={editingDescription}
                                                        onChange={(e) => setEditingDescription(e.target.value)}
                                                        rows={2}
                                                    />
                                                ) : (
                                                    <span className="muted">
                                                        {typeof f.description === 'string' ? f.description : ''}
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                {isEditing ? (
                                                    <select
                                                        className="intervalSelect"
                                                        value={editingStatus}
                                                        onChange={(e) => setEditingStatus(e.target.value as TaskStatus)}
                                                    >
                                                        {allStatus.map((s) => (
                                                            <option key={s} value={s}>
                                                                {statusLabel(s)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span>{statusLabel(f.status as TaskStatus)}</span>
                                                )}
                                            </td>
                                            <td>
                                                <div
                                                    className="inlineActions"
                                                    style={{ justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 }}
                                                >
                                                    {!isEditing && (
                                                        <div className="iconBtnRow">
                                                            <button
                                                                type="button"
                                                                className="iconBtn"
                                                                title="Edit feature"
                                                                aria-label="Edit feature"
                                                                onClick={() => startEdit(f)}
                                                            >
                                                                <IconEdit />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="iconBtn iconBtnDanger"
                                                                title="Delete feature"
                                                                aria-label="Delete feature"
                                                                onClick={() => void onDelete(f)}
                                                            >
                                                                <IconTrash />
                                                            </button>
                                                        </div>
                                                    )}
                                                    {isEditing && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="btn btnPrimary"
                                                                disabled={
                                                                    !normalizeName(editingName) ||
                                                                    state.kind === 'loading'
                                                                }
                                                                onClick={() => void onSaveEdit()}
                                                            >
                                                                Save
                                                            </button>
                                                            <button type="button" className="btn" onClick={stopEdit}>
                                                                Cancel
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="iconBtn iconBtnDanger"
                                                                title="Delete feature"
                                                                aria-label="Delete feature"
                                                                onClick={() => void onDelete(f)}
                                                            >
                                                                <IconTrash />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
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
    )
}

function GameCategoriesSection({ gameId, onCategoriesChanged }: { gameId: string; onCategoriesChanged: () => void }) {
    const [categories, setCategories] = useState<Category[]>([])
    const [state, setState] = useState<UiState>({ kind: 'idle' })
    const [createName, setCreateName] = useState('')
    const [createColor, setCreateColor] = useState(DEFAULT_COLOR)

    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState('')
    const [editingColor, setEditingColor] = useState(DEFAULT_COLOR)

    const refresh = useCallback(async () => {
        setState({ kind: 'loading', message: 'Loading categories…' })
        try {
            const data = await listCategories(gameId)
            setCategories(data)
            setState({ kind: 'idle' })
        } catch {
            setCategories([])
            setState({ kind: 'error', message: 'Failed to load categories.' })
        }
    }, [gameId])

    useEffect(() => {
        const timer = window.setTimeout(() => void refresh(), 0)
        return () => window.clearTimeout(timer)
    }, [refresh])

    const canCreate = useMemo(() => normalizeName(createName).length > 0, [createName])

    const startEdit = (c: Category) => {
        setEditingId(c.id)
        setEditingName(c.name)
        setEditingColor(categoryRowColor(c))
        setState({ kind: 'idle' })
    }

    const stopEdit = () => {
        setEditingId(null)
        setEditingName('')
        setEditingColor(DEFAULT_COLOR)
    }

    const onCreate = async () => {
        const name = normalizeName(createName)
        if (!name) return
        setState({ kind: 'loading', message: 'Creating category…' })
        try {
            await createCategory(gameId, {
                name,
                color: normalizeHexColor(createColor),
            })
            setCreateName('')
            setCreateColor(DEFAULT_COLOR)
            await refresh()
            onCategoriesChanged()
            setState({ kind: 'success', message: 'Category created.' })
        } catch (err) {
            const message = isAxiosStatus(err, 409) ? 'Category name already exists.' : 'Failed to create category.'
            setState({ kind: 'error', message })
        }
    }

    const onSaveEdit = async () => {
        if (!editingId) return
        const name = normalizeName(editingName)
        if (!name) return
        setState({ kind: 'loading', message: 'Saving…' })
        try {
            await updateCategory(gameId, editingId, {
                name,
                color: normalizeHexColor(editingColor),
            })
            stopEdit()
            await refresh()
            onCategoriesChanged()
            setState({ kind: 'success', message: 'Category updated.' })
        } catch (err) {
            const message = isAxiosStatus(err, 409) ? 'Category name already exists.' : 'Failed to update category.'
            setState({ kind: 'error', message })
        }
    }

    const onDelete = async (c: Category) => {
        const ok = window.confirm(`Delete category "${c.name}"?`)
        if (!ok) return
        setState({ kind: 'loading', message: 'Deleting…' })
        try {
            await deleteCategory(gameId, c.id)
            await refresh()
            onCategoriesChanged()
            setState({ kind: 'success', message: 'Category deleted.' })
        } catch (err) {
            const message = isAxiosStatus(err, 409)
                ? 'Category is in use and cannot be deleted.'
                : 'Failed to delete category.'
            setState({ kind: 'error', message })
        }
    }

    return (
        <section className="gamePageSection">
            <div className="cardHeader">
                <h2 className="cardTitle">Categories</h2>
            </div>
            <div className="cardBody">
                {state.kind === 'error' && <div className="banner bannerError">{state.message}</div>}
                {state.kind === 'success' && <div className="banner bannerSuccess">{state.message}</div>}
                {state.kind === 'loading' && <div className="banner">{state.message}</div>}

                <p className="muted" style={{ marginBottom: 12 }}>
                    Categories are used with tasks (name and color only).
                </p>

                <div className="featureCreateGrid" style={{ marginBottom: 16 }}>
                    <input
                        className="textInput"
                        value={createName}
                        placeholder="New category name"
                        onChange={(e) => setCreateName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') void onCreate()
                        }}
                        aria-label="New category name"
                    />
                    <input
                        type="color"
                        value={createColor}
                        onChange={(e) => setCreateColor(e.target.value)}
                        title="Category color"
                        aria-label="Category color"
                        style={{
                            width: 52,
                            height: 36,
                            padding: 2,
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'var(--panel)',
                        }}
                    />
                    <button
                        type="button"
                        className="btn btnPrimary featureCreateSubmit"
                        disabled={!canCreate || state.kind === 'loading'}
                        onClick={() => void onCreate()}
                    >
                        Add
                    </button>
                </div>

                {categories.length === 0 && state.kind !== 'loading' && (
                    <div className="emptyState">No categories yet. Add one above.</div>
                )}

                {categories.length > 0 && (
                    <div className="tableWrap">
                        <table className="table tableCompact">
                            <thead>
                                <tr>
                                    <th style={{ width: 36 }} aria-label="Color" />
                                    <th>Name</th>
                                    <th style={{ width: 88 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {categories.map((c, idx) => {
                                    const isEditing = editingId === c.id
                                    const cc = categoryRowColor(c)
                                    return (
                                        <tr key={c.id} data-odd={idx % 2 === 1}>
                                            <td>
                                                {isEditing ? (
                                                    <input
                                                        type="color"
                                                        value={
                                                            /^#[0-9A-Fa-f]{6}$/i.test(editingColor)
                                                                ? editingColor
                                                                : DEFAULT_COLOR
                                                        }
                                                        onChange={(e) => setEditingColor(e.target.value)}
                                                        title="Category color"
                                                        aria-label="Category color"
                                                        style={{
                                                            width: 36,
                                                            height: 32,
                                                            padding: 0,
                                                            borderRadius: 8,
                                                            border: '1px solid rgba(255,255,255,0.12)',
                                                        }}
                                                    />
                                                ) : (
                                                    <span
                                                        className="featureSwatch"
                                                        style={{ backgroundColor: cc, width: 14, height: 14 }}
                                                    />
                                                )}
                                            </td>
                                            <td>
                                                {isEditing ? (
                                                    <input
                                                        className="textInput"
                                                        value={editingName}
                                                        onChange={(e) => setEditingName(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') void onSaveEdit()
                                                            if (e.key === 'Escape') stopEdit()
                                                        }}
                                                        aria-label={`Edit category ${c.name}`}
                                                    />
                                                ) : (
                                                    <span style={{ color: cc }}>{c.name}</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="iconBtnRow" style={{ justifyContent: 'flex-end' }}>
                                                    {!isEditing && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="iconBtn"
                                                                title="Edit category"
                                                                aria-label="Edit category"
                                                                onClick={() => startEdit(c)}
                                                            >
                                                                <IconEdit />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="iconBtn iconBtnDanger"
                                                                title="Delete category"
                                                                aria-label="Delete category"
                                                                onClick={() => void onDelete(c)}
                                                            >
                                                                <IconTrash />
                                                            </button>
                                                        </>
                                                    )}
                                                    {isEditing && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="btn btnPrimary"
                                                                disabled={
                                                                    !normalizeName(editingName) ||
                                                                    state.kind === 'loading'
                                                                }
                                                                onClick={() => void onSaveEdit()}
                                                            >
                                                                Save
                                                            </button>
                                                            <button type="button" className="btn" onClick={stopEdit}>
                                                                Cancel
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
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
    )
}

function tagRowColor(t: Tag) {
    const col = t.color
    if (col && /^#[0-9A-Fa-f]{6}$/i.test(col)) return col.toLowerCase()
    return DEFAULT_COLOR
}

function GameTagsSection({ gameId }: { gameId: string }) {
    const [tags, setTags] = useState<Tag[]>([])
    const [state, setState] = useState<UiState>({ kind: 'idle' })
    const [createName, setCreateName] = useState('')
    const [createColor, setCreateColor] = useState(DEFAULT_COLOR)
    const [createDescription, setCreateDescription] = useState('')

    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState('')
    const [editingColor, setEditingColor] = useState(DEFAULT_COLOR)
    const [editingDescription, setEditingDescription] = useState('')

    const refresh = useCallback(async () => {
        setState({ kind: 'loading', message: 'Loading tags…' })
        try {
            const data = await listTags(gameId)
            setTags(data)
            setState({ kind: 'idle' })
        } catch {
            setTags([])
            setState({ kind: 'error', message: 'Failed to load tags.' })
        }
    }, [gameId])

    useEffect(() => {
        const timer = window.setTimeout(() => void refresh(), 0)
        return () => window.clearTimeout(timer)
    }, [refresh])

    const canCreate = useMemo(() => normalizeName(createName).length > 0, [createName])

    const startEdit = (t: Tag) => {
        setEditingId(t.id)
        setEditingName(t.name)
        setEditingColor(tagRowColor(t))
        setEditingDescription(typeof t.description === 'string' ? t.description : '')
        setState({ kind: 'idle' })
    }

    const stopEdit = () => {
        setEditingId(null)
        setEditingName('')
        setEditingColor(DEFAULT_COLOR)
        setEditingDescription('')
    }

    const onCreate = async () => {
        const name = normalizeName(createName)
        if (!name) return
        setState({ kind: 'loading', message: 'Creating tag…' })
        try {
            const desc = createDescription.trim()
            await createTag(gameId, {
                name,
                color: normalizeHexColor(createColor),
                description: desc.length > 0 ? desc : null,
            })
            setCreateName('')
            setCreateColor(DEFAULT_COLOR)
            setCreateDescription('')
            await refresh()
            setState({ kind: 'success', message: 'Tag created.' })
        } catch (err) {
            const message = isAxiosStatus(err, 409) ? 'Tag name already exists.' : 'Failed to create tag.'
            setState({ kind: 'error', message })
        }
    }

    const onSaveEdit = async () => {
        if (!editingId) return
        const name = normalizeName(editingName)
        if (!name) return
        setState({ kind: 'loading', message: 'Saving…' })
        try {
            const desc = editingDescription.trim()
            await updateTag(gameId, editingId, {
                name,
                color: normalizeHexColor(editingColor),
                description: desc.length > 0 ? desc : null,
            })
            stopEdit()
            await refresh()
            setState({ kind: 'success', message: 'Tag updated.' })
        } catch (err) {
            const message = isAxiosStatus(err, 409) ? 'Tag name already exists.' : 'Failed to update tag.'
            setState({ kind: 'error', message })
        }
    }

    const onDelete = async (t: Tag) => {
        const ok = window.confirm(`Delete tag "${t.name}"?`)
        if (!ok) return
        setState({ kind: 'loading', message: 'Deleting…' })
        try {
            await deleteTag(gameId, t.id)
            await refresh()
            setState({ kind: 'success', message: 'Tag deleted.' })
        } catch (err) {
            const message = isAxiosStatus(err, 409) ? 'Tag is in use and cannot be deleted.' : 'Failed to delete tag.'
            setState({ kind: 'error', message })
        }
    }

    const previewHex = normalizeHexColor(createColor)

    return (
        <section className="gamePageSection">
            <div className="cardHeader">
                <h2 className="cardTitle">Tags</h2>
            </div>
            <div className="cardBody">
                {state.kind === 'error' && <div className="banner bannerError">{state.message}</div>}
                {state.kind === 'success' && <div className="banner bannerSuccess">{state.message}</div>}
                {state.kind === 'loading' && <div className="banner">{state.message}</div>}

                <p className="muted" style={{ marginBottom: 12 }}>
                    Tags can be attached to tasks (name, color, optional description). They appear as chips on the Tasks
                    page.
                </p>

                <div className="featureCreateGrid" style={{ marginBottom: 12 }}>
                    <input
                        className="textInput"
                        value={createName}
                        placeholder="New tag name"
                        onChange={(e) => setCreateName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') void onCreate()
                        }}
                        aria-label="New tag name"
                    />
                    <input
                        type="color"
                        value={createColor}
                        onChange={(e) => setCreateColor(e.target.value)}
                        title="Tag color"
                        aria-label="Tag color"
                        style={{
                            width: 52,
                            height: 36,
                            padding: 2,
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'var(--panel)',
                        }}
                    />
                    <button
                        type="button"
                        className="btn btnPrimary featureCreateSubmit"
                        disabled={!canCreate || state.kind === 'loading'}
                        onClick={() => void onCreate()}
                    >
                        Add
                    </button>
                </div>
                <div style={{ marginBottom: 16 }}>
                    <label className="modalFieldLabel" htmlFor="new-tag-desc">
                        Description (optional)
                    </label>
                    <textarea
                        id="new-tag-desc"
                        className="textArea"
                        rows={2}
                        value={createDescription}
                        placeholder="Optional notes for this tag"
                        onChange={(e) => setCreateDescription(e.target.value)}
                    />
                </div>
                <div className="muted" style={{ marginBottom: 16, fontSize: 13 }}>
                    Preview:{' '}
                    <span
                        className="tagChip"
                        style={{
                            backgroundColor: previewHex,
                            color: chipTextColor(previewHex),
                        }}
                    >
                        #{normalizeName(createName) || 'tag'}
                    </span>
                </div>

                {tags.length === 0 && state.kind !== 'loading' && (
                    <div className="emptyState">No tags yet. Add one above.</div>
                )}

                {tags.length > 0 && (
                    <div className="tableWrap">
                        <table className="table tableCompact">
                            <thead>
                                <tr>
                                    <th style={{ width: 36 }} aria-label="Color" />
                                    <th>Name</th>
                                    <th>Description</th>
                                    <th style={{ width: 88 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {tags.map((t, idx) => {
                                    const isEditing = editingId === t.id
                                    const tc = tagRowColor(t)
                                    return (
                                        <tr key={t.id} data-odd={idx % 2 === 1}>
                                            <td>
                                                {isEditing ? (
                                                    <input
                                                        type="color"
                                                        value={
                                                            /^#[0-9A-Fa-f]{6}$/i.test(editingColor)
                                                                ? editingColor
                                                                : DEFAULT_COLOR
                                                        }
                                                        onChange={(e) => setEditingColor(e.target.value)}
                                                        title="Tag color"
                                                        aria-label="Tag color"
                                                        style={{
                                                            width: 36,
                                                            height: 32,
                                                            padding: 0,
                                                            borderRadius: 8,
                                                            border: '1px solid rgba(255,255,255,0.12)',
                                                        }}
                                                    />
                                                ) : (
                                                    <span
                                                        className="featureSwatch"
                                                        style={{ backgroundColor: tc, width: 14, height: 14 }}
                                                    />
                                                )}
                                            </td>
                                            <td>
                                                {isEditing ? (
                                                    <input
                                                        className="textInput"
                                                        value={editingName}
                                                        onChange={(e) => setEditingName(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') void onSaveEdit()
                                                            if (e.key === 'Escape') stopEdit()
                                                        }}
                                                        aria-label={`Edit tag ${t.name}`}
                                                    />
                                                ) : (
                                                    <span className="tagChipRow">
                                                        <span
                                                            className="tagChip"
                                                            style={{
                                                                backgroundColor: tc,
                                                                color: chipTextColor(tc),
                                                            }}
                                                        >
                                                            #{t.name}
                                                        </span>
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                {isEditing ? (
                                                    <textarea
                                                        className="textArea"
                                                        rows={2}
                                                        value={editingDescription}
                                                        placeholder="Optional"
                                                        onChange={(e) => setEditingDescription(e.target.value)}
                                                    />
                                                ) : (
                                                    <span className="muted" style={{ fontSize: 13 }}>
                                                        {t.description && t.description.trim().length > 0
                                                            ? t.description
                                                            : '—'}
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="iconBtnRow" style={{ justifyContent: 'flex-end' }}>
                                                    {!isEditing && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="iconBtn"
                                                                title="Edit tag"
                                                                aria-label="Edit tag"
                                                                onClick={() => startEdit(t)}
                                                            >
                                                                <IconEdit />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="iconBtn iconBtnDanger"
                                                                title="Delete tag"
                                                                aria-label="Delete tag"
                                                                onClick={() => void onDelete(t)}
                                                            >
                                                                <IconTrash />
                                                            </button>
                                                        </>
                                                    )}
                                                    {isEditing && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="btn btnPrimary"
                                                                disabled={
                                                                    !normalizeName(editingName) ||
                                                                    state.kind === 'loading'
                                                                }
                                                                onClick={() => void onSaveEdit()}
                                                            >
                                                                Save
                                                            </button>
                                                            <button type="button" className="btn" onClick={stopEdit}>
                                                                Cancel
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
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
    )
}

const GAME_EVENT_PLACEHOLDERS =
    'Placeholders use angle brackets and uppercase names, e.g. <PLAYER_ID>, <KEY>, <VALUE>, <MAP>, <X>, <Y>, <Z>. The game sends matching keys in parameters (keys are matched case-insensitively).'

const INGEST_TOKEN_SECTION_SUBTITLE =
    'Authenticates your game client for posting events without a browser session or CSRF token.'

const MAX_TEMPLATE_CHARS = 100

const CREATE_EVENT_DEFINITION_SUBTITLE = `Message templates are at most ${MAX_TEMPLATE_CHARS} characters. ${GAME_EVENT_PLACEHOLDERS}`

function normalizeDefinitionCode(raw: string) {
    return raw.trim().toLowerCase().replace(/\s+/g, '_')
}

function definitionRowColor(d: { color?: string | null }) {
    const c = d.color
    if (c && /^#[0-9A-Fa-f]{6}$/i.test(c)) return c.toLowerCase()
    return DEFAULT_COLOR
}

async function fileToValidatedIconDataUrl(file: File): Promise<string> {
    const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Could not read file.'))
        reader.readAsDataURL(file)
    })
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Invalid image.'))
        img.src = dataUrl
    })
    if (img.width > 16 || img.height > 16) {
        throw new Error('Image must be at most 16×16 pixels.')
    }
    return dataUrl
}

function GameEventsSection({ gameId }: { gameId: string }) {
    const [definitions, setDefinitions] = useState<GameEventDefinition[]>([])
    const [ingestConfigured, setIngestConfigured] = useState(false)
    const [ingestCreatedAt, setIngestCreatedAt] = useState<string | null>(null)
    const [lastRevealedIngestToken, setLastRevealedIngestToken] = useState<string | null>(null)
    const [state, setState] = useState<UiState>({ kind: 'idle' })

    const [createCode, setCreateCode] = useState('')
    const [createDisplayName, setCreateDisplayName] = useState('')
    const [createTemplate, setCreateTemplate] = useState('')
    const [createImageData, setCreateImageData] = useState<string | null>(null)
    const [createColor, setCreateColor] = useState(DEFAULT_COLOR)

    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingCode, setEditingCode] = useState('')
    const [editingDisplayName, setEditingDisplayName] = useState('')
    const [editingTemplate, setEditingTemplate] = useState('')
    const [editingImageData, setEditingImageData] = useState<string | null>(null)
    const [editingColor, setEditingColor] = useState(DEFAULT_COLOR)

    const load = useCallback(async () => {
        setState({ kind: 'loading', message: 'Loading game events…' })
        try {
            const [defs, tok] = await Promise.all([listGameEventDefinitions(gameId), getIngestTokenStatus(gameId)])
            setDefinitions(defs)
            setIngestConfigured(!!tok.configured)
            setIngestCreatedAt(tok.createdAt ?? null)
            setState({ kind: 'idle' })
        } catch {
            setDefinitions([])
            setState({ kind: 'error', message: 'Failed to load game event configuration.' })
        }
    }, [gameId])

    useEffect(() => {
        const t = window.setTimeout(() => void load(), 0)
        return () => window.clearTimeout(t)
    }, [load])

    const onRegenerateToken = async () => {
        const ok = window.confirm(
            'Regenerate the ingest token? The old token will stop working immediately. Copy the new value now; it is only shown once.'
        )
        if (!ok) return
        setState({ kind: 'loading', message: 'Regenerating token…' })
        try {
            const res = await regenerateIngestToken(gameId)
            setIngestConfigured(true)
            setIngestCreatedAt(res.createdAt ?? null)
            setLastRevealedIngestToken(res.token)
            setState({ kind: 'success', message: 'New token generated. Store it in a safe place.' })
            await navigator.clipboard.writeText(res.token)
        } catch {
            setState({ kind: 'error', message: 'Failed to regenerate ingest token.' })
        }
    }

    const onCreate = async () => {
        const code = normalizeDefinitionCode(createCode)
        if (!code || !createTemplate.trim()) return
        if (createTemplate.length > MAX_TEMPLATE_CHARS) {
            setState({ kind: 'error', message: `Message template must be at most ${MAX_TEMPLATE_CHARS} characters.` })
            return
        }
        setState({ kind: 'loading', message: 'Creating definition…' })
        try {
            await createGameEventDefinition(gameId, {
                code,
                displayName: createDisplayName.trim() || null,
                messageTemplate: createTemplate.trim(),
                imageData: createImageData,
                color: normalizeHexColor(createColor),
            })
            setCreateCode('')
            setCreateDisplayName('')
            setCreateTemplate('')
            setCreateImageData(null)
            setCreateColor(DEFAULT_COLOR)
            await load()
            setState({ kind: 'success', message: 'Game event definition created.' })
        } catch (err) {
            const message = isAxiosStatus(err, 409)
                ? 'That event code already exists for this game.'
                : 'Failed to create game event definition.'
            setState({ kind: 'error', message })
        }
    }

    const startEdit = (d: GameEventDefinition) => {
        setEditingId(d.id)
        setEditingCode(d.code)
        setEditingDisplayName(typeof d.displayName === 'string' ? d.displayName : '')
        setEditingTemplate(d.messageTemplate)
        setEditingImageData(d.imageData ?? null)
        setEditingColor(definitionRowColor(d))
    }

    const stopEdit = () => {
        setEditingId(null)
        setEditingCode('')
        setEditingDisplayName('')
        setEditingTemplate('')
        setEditingImageData(null)
        setEditingColor(DEFAULT_COLOR)
    }

    const onSaveEdit = async () => {
        if (!editingId) return
        const code = normalizeDefinitionCode(editingCode)
        if (!code || !editingTemplate.trim()) return
        if (editingTemplate.length > MAX_TEMPLATE_CHARS) {
            setState({ kind: 'error', message: `Message template must be at most ${MAX_TEMPLATE_CHARS} characters.` })
            return
        }
        setState({ kind: 'loading', message: 'Saving…' })
        try {
            await updateGameEventDefinition(gameId, editingId, {
                code,
                displayName: editingDisplayName.trim() || null,
                messageTemplate: editingTemplate.trim(),
                imageData: editingImageData,
                color: normalizeHexColor(editingColor),
            })
            stopEdit()
            await load()
            setState({ kind: 'success', message: 'Game event definition updated.' })
        } catch (err) {
            const message = isAxiosStatus(err, 409)
                ? 'That event code already exists for this game.'
                : 'Failed to update game event definition.'
            setState({ kind: 'error', message })
        }
    }

    const onDelete = async (d: GameEventDefinition) => {
        const ok = window.confirm(`Delete event definition "${d.code}"?`)
        if (!ok) return
        setState({ kind: 'loading', message: 'Deleting…' })
        try {
            await deleteGameEventDefinition(gameId, d.id)
            await load()
            setState({ kind: 'success', message: 'Definition deleted.' })
        } catch (err) {
            const message = isAxiosStatus(err, 409)
                ? 'Cannot delete: recorded events exist for this definition.'
                : 'Failed to delete definition.'
            setState({ kind: 'error', message })
        }
    }

    const onPickIconCreate = async (fileList: FileList | null) => {
        const file = fileList?.[0]
        if (!file) return
        try {
            const dataUrl = await fileToValidatedIconDataUrl(file)
            setCreateImageData(dataUrl)
            setState({ kind: 'idle' })
        } catch (e) {
            setCreateImageData(null)
            setState({
                kind: 'error',
                message: e instanceof Error ? e.message : 'Invalid icon image.',
            })
        }
    }

    const onPickIconEdit = async (fileList: FileList | null) => {
        const file = fileList?.[0]
        if (!file) return
        try {
            const dataUrl = await fileToValidatedIconDataUrl(file)
            setEditingImageData(dataUrl)
            setState({ kind: 'idle' })
        } catch (e) {
            setState({
                kind: 'error',
                message: e instanceof Error ? e.message : 'Invalid icon image.',
            })
        }
    }

    const canCreate =
        normalizeDefinitionCode(createCode).length > 0 &&
        createTemplate.trim().length > 0 &&
        createTemplate.length <= MAX_TEMPLATE_CHARS

    const onCopyRevealedToken = async () => {
        if (!lastRevealedIngestToken) return
        try {
            await navigator.clipboard.writeText(lastRevealedIngestToken)
        } catch {
            /* ignore */
        }
    }

    return (
        <section className="gamePageSection">
            <div className="cardHeader">
                <h2 className="cardTitle">Game events</h2>
            </div>
            <div className="cardBody">
                {state.kind === 'error' && <div className="banner bannerError">{state.message}</div>}
                {state.kind === 'success' && <div className="banner bannerSuccess">{state.message}</div>}
                {state.kind === 'loading' && <div className="banner">{state.message}</div>}

                <div className="gameEventsSubPanel">
                    <h3 className="gameEventsSectionPanelTitle">Ingest token</h3>
                    <p className="gameEventsSectionSubtitle">{INGEST_TOKEN_SECTION_SUBTITLE}</p>
                    <p style={{ margin: '0 0 10px', opacity: 0.85, fontSize: 13 }}>
                        The game client sends <code style={{ fontSize: 12 }}>Authorization: Bearer &lt;token&gt;</code>{' '}
                        on <code style={{ fontSize: 12 }}>POST /api/games/&#123;gameId&#125;/game-events/ingest</code>.
                        CSRF is not required for that endpoint.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                        <span style={{ fontSize: 13 }}>
                            Status: <strong>{ingestConfigured ? 'configured' : 'not set'}</strong>
                            {ingestCreatedAt && (
                                <span style={{ opacity: 0.75, marginLeft: 8 }}>
                                    (last created {new Date(ingestCreatedAt).toLocaleString()})
                                </span>
                            )}
                        </span>
                        <button
                            type="button"
                            className="btn btnPrimary"
                            disabled={state.kind === 'loading'}
                            onClick={() => void onRegenerateToken()}
                        >
                            Regenerate token
                        </button>
                    </div>
                    {lastRevealedIngestToken && (
                        <div className="ingestTokenReveal">
                            <span className="ingestTokenRevealLabel">
                                Current token (shown until you leave or refresh this page — store it securely):
                            </span>
                            <code className="ingestTokenRevealValue">{lastRevealedIngestToken}</code>
                            <div className="ingestTokenRevealActions">
                                <button type="button" className="btn" onClick={() => void onCopyRevealedToken()}>
                                    Copy token
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="gameEventsSubPanel">
                    <h3 className="gameEventsSectionPanelTitle">Create event definition</h3>
                    <p className="gameEventsSectionSubtitle">{CREATE_EVENT_DEFINITION_SUBTITLE}</p>
                    <div className="gameEventDefinitionCreate">
                        <div className="gameEventDefinitionCreateRow">
                            <input
                                className="textInput"
                                value={createCode}
                                placeholder="Event code (e.g. loot)"
                                onChange={(e) => setCreateCode(e.target.value)}
                                aria-label="New event code"
                            />
                            <input
                                className="textInput"
                                value={createDisplayName}
                                placeholder="Display name (optional)"
                                onChange={(e) => setCreateDisplayName(e.target.value)}
                                aria-label="Display name"
                            />
                        </div>
                        <div className="gameEventDefinitionCreateColorRow">
                            <span>Color:</span>
                            <input
                                type="color"
                                value={/^#[0-9A-Fa-f]{6}$/i.test(createColor) ? createColor : DEFAULT_COLOR}
                                onChange={(e) => setCreateColor(e.target.value)}
                                title="Event color"
                                aria-label="Pick event color"
                            />
                            <span className="gameEventDefinitionCreateHex">{normalizeHexColor(createColor)}</span>
                        </div>
                        <textarea
                            className="textArea gameEventDefinitionCreateTemplate"
                            value={createTemplate}
                            placeholder={`Message template (max ${MAX_TEMPLATE_CHARS} chars)`}
                            onChange={(e) => setCreateTemplate(e.target.value)}
                            rows={2}
                            maxLength={MAX_TEMPLATE_CHARS}
                        />
                        <div className="gameEventDefinitionCreateFooter">
                            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span>Icon (≤16×16)</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => void onPickIconCreate(e.target.files)}
                                />
                            </label>
                            {createImageData && (
                                <img
                                    src={createImageData}
                                    alt=""
                                    width={16}
                                    height={16}
                                    style={{ imageRendering: 'pixelated' }}
                                />
                            )}
                            <button
                                type="button"
                                className="btn btnPrimary"
                                disabled={!canCreate || state.kind === 'loading'}
                                onClick={() => void onCreate()}
                            >
                                Add
                            </button>
                        </div>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 10 }}>
                        Template length: {createTemplate.length}/{MAX_TEMPLATE_CHARS}
                    </div>
                </div>

                {definitions.length === 0 && state.kind !== 'loading' && (
                    <div className="emptyState">No game event definitions yet.</div>
                )}

                {definitions.length > 0 && (
                    <div className="tableWrap">
                        <table className="table tableCompact">
                            <thead>
                                <tr>
                                    <th style={{ width: 24 }} aria-label="Icon" />
                                    <th style={{ width: 36 }} aria-label="Color" />
                                    <th style={{ width: '12%' }}>Code</th>
                                    <th style={{ width: '18%' }}>Display</th>
                                    <th>Message template</th>
                                    <th style={{ width: 88 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {definitions.map((d, idx) => {
                                    const isEditing = editingId === d.id
                                    return (
                                        <tr key={d.id} data-odd={idx % 2 === 1}>
                                            <td>
                                                {d.imageData ? (
                                                    <img
                                                        src={d.imageData}
                                                        alt=""
                                                        width={16}
                                                        height={16}
                                                        style={{ imageRendering: 'pixelated' }}
                                                    />
                                                ) : (
                                                    <span style={{ opacity: 0.35 }}>—</span>
                                                )}
                                            </td>
                                            <td>
                                                {isEditing ? (
                                                    <input
                                                        type="color"
                                                        value={
                                                            /^#[0-9A-Fa-f]{6}$/i.test(editingColor)
                                                                ? editingColor
                                                                : DEFAULT_COLOR
                                                        }
                                                        onChange={(e) => setEditingColor(e.target.value)}
                                                        title="Event color"
                                                        aria-label="Event color"
                                                        style={{
                                                            width: 36,
                                                            height: 32,
                                                            padding: 0,
                                                            borderRadius: 8,
                                                            border: '1px solid rgba(255,255,255,0.12)',
                                                        }}
                                                    />
                                                ) : (
                                                    <span
                                                        className="featureSwatch"
                                                        style={{
                                                            backgroundColor: definitionRowColor(d),
                                                            width: 14,
                                                            height: 14,
                                                        }}
                                                    />
                                                )}
                                            </td>
                                            <td>
                                                {isEditing ? (
                                                    <input
                                                        className="textInput"
                                                        value={editingCode}
                                                        onChange={(e) => setEditingCode(e.target.value)}
                                                        aria-label="Edit code"
                                                    />
                                                ) : (
                                                    <code>{d.code}</code>
                                                )}
                                            </td>
                                            <td>
                                                {isEditing ? (
                                                    <input
                                                        className="textInput"
                                                        value={editingDisplayName}
                                                        onChange={(e) => setEditingDisplayName(e.target.value)}
                                                        aria-label="Edit display name"
                                                    />
                                                ) : (
                                                    (d.displayName ?? '—')
                                                )}
                                            </td>
                                            <td>
                                                {isEditing ? (
                                                    <textarea
                                                        className="textArea"
                                                        value={editingTemplate}
                                                        onChange={(e) => setEditingTemplate(e.target.value)}
                                                        rows={2}
                                                        maxLength={MAX_TEMPLATE_CHARS}
                                                        aria-label="Edit template"
                                                    />
                                                ) : (
                                                    <span title={d.messageTemplate}>{d.messageTemplate}</span>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                                    {!isEditing && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="iconBtn"
                                                                title="Edit"
                                                                aria-label="Edit"
                                                                onClick={() => startEdit(d)}
                                                            >
                                                                <IconEdit />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="iconBtn iconBtnDanger"
                                                                title="Delete"
                                                                aria-label="Delete"
                                                                onClick={() => void onDelete(d)}
                                                            >
                                                                <IconTrash />
                                                            </button>
                                                        </>
                                                    )}
                                                    {isEditing && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="btn btnPrimary"
                                                                disabled={
                                                                    !normalizeDefinitionCode(editingCode) ||
                                                                    !editingTemplate.trim() ||
                                                                    editingTemplate.length > MAX_TEMPLATE_CHARS ||
                                                                    state.kind === 'loading'
                                                                }
                                                                onClick={() => void onSaveEdit()}
                                                            >
                                                                Save
                                                            </button>
                                                            <button type="button" className="btn" onClick={stopEdit}>
                                                                Cancel
                                                            </button>
                                                            <label style={{ fontSize: 11 }}>
                                                                Icon
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    style={{ marginLeft: 6 }}
                                                                    onChange={(e) =>
                                                                        void onPickIconEdit(e.target.files)
                                                                    }
                                                                />
                                                            </label>
                                                        </>
                                                    )}
                                                </div>
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
    )
}

export function ConfigurationPage() {
    const gameId = useGameId()
    const [configRefresh, setConfigRefresh] = useState(0)
    const bumpConfigAndCategories = useCallback(() => setConfigRefresh((t) => t + 1), [])

    return (
        <div className="gamePageStack configurationPage">
            <GameConfigFormSection gameId={gameId} refreshToken={configRefresh} />
            <GameFeaturesSection gameId={gameId} />
            <GameEventsSection gameId={gameId} />
            <GameCategoriesSection gameId={gameId} onCategoriesChanged={bumpConfigAndCategories} />
            <GameTagsSection gameId={gameId} />
        </div>
    )
}
