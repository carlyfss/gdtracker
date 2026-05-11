import { useCallback, useEffect, useState } from 'react'
import type { Category } from '../../../api/categories'
import { listCategories } from '../../../api/categories'
import { getConfiguration, patchConfiguration } from '../../../api/configuration'
import { IconTrash } from '../../../components/icons'
import { useGameTheme } from '../../../context/GameThemeContext'
import type { UiState } from '../configurationUtils'
import { GameIngestTokenSection } from './GameIngestTokenSection'

type FlagRow = { id: string; key: string; on: boolean }
type SettingRow = { id: string; key: string; value: string }

const ARCHIVE_TIME_BOMB = 'ARCHIVE_TIME_BOMB'

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

export function GameConfigFormSection({ gameId, refreshToken }: { gameId: string; refreshToken: number }) {
    const { refreshTheme } = useGameTheme()
    const [state, setState] = useState<UiState>({ kind: 'idle' })
    const [categories, setCategories] = useState<Category[]>([])
    const [flagRows, setFlagRows] = useState<FlagRow[]>([])
    const [settingRows, setSettingRows] = useState<SettingRow[]>([])
    const [exceptionTitleTemplate, setExceptionTitleTemplate] = useState('')
    const [exceptionDescriptionTemplate, setExceptionDescriptionTemplate] = useState('')
    const [exceptionTemplateCategoryId, setExceptionTemplateCategoryId] = useState<string | null>(null)

    const load = useCallback(async () => {
        setState({ kind: 'loading', message: 'Loading configuration…' })
        try {
            const [cfg, cats] = await Promise.all([getConfiguration(gameId), listCategories(gameId)])
            setCategories(cats)
            setFlagRows(rowsFromFlags(cfg.featureFlags ?? {}))
            setSettingRows(rowsFromSettings(cfg.settings ?? {}))
            const et = cfg.exceptionTaskTemplate
            setExceptionTitleTemplate(et?.titleTemplate ?? 'Fix Exception #<EXCEPTION_INDEX>')
            setExceptionDescriptionTemplate(et?.descriptionTemplate ?? '```\n<EXCEPTION_TRACE>\n```')
            setExceptionTemplateCategoryId(et?.defaultCategoryId ?? null)
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

    const addArchiveTimebombSetting = () => {
        setSettingRows((rows) => {
            if (rows.some((r) => r.key.trim().toUpperCase() === ARCHIVE_TIME_BOMB)) return rows
            return [...rows, { id: `ns-${Date.now()}-${ARCHIVE_TIME_BOMB}`, key: ARCHIVE_TIME_BOMB, value: '30' }]
        })
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
                exceptionTaskTemplate: {
                    titleTemplate: exceptionTitleTemplate,
                    descriptionTemplate: exceptionDescriptionTemplate,
                    defaultCategoryId:
                        exceptionTemplateCategoryId && exceptionTemplateCategoryId.length > 0
                            ? exceptionTemplateCategoryId
                            : null,
                },
            })
            setFlagRows(rowsFromFlags(updated.featureFlags ?? {}))
            setSettingRows(rowsFromSettings(updated.settings ?? {}))
            const uet = updated.exceptionTaskTemplate
            setExceptionTitleTemplate(uet?.titleTemplate ?? 'Fix Exception #<EXCEPTION_INDEX>')
            setExceptionDescriptionTemplate(uet?.descriptionTemplate ?? '```\n<EXCEPTION_TRACE>\n```')
            setExceptionTemplateCategoryId(uet?.defaultCategoryId ?? null)
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

                <h3 className="configSubheading">Settings</h3>
                <p className="muted" style={{ marginBottom: 12 }}>
                    String values, numbers, or the words <code>true</code>/<code>false</code> for booleans. Empty keys
                    are ignored on save.
                </p>
                <p className="muted" style={{ marginTop: -6, marginBottom: 12, fontSize: 13 }}>
                    <strong>{ARCHIVE_TIME_BOMB}</strong>: number of days before archived features/tasks are permanently
                    deleted (default 30).
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
                            {settingRows.map((row) => (
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
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
                    <button type="button" className="btn" onClick={addSettingRow}>
                        Add setting
                    </button>
                    <button type="button" className="btn" onClick={addArchiveTimebombSetting}>
                        Add archive timebomb
                    </button>
                </div>

                <GameIngestTokenSection gameId={gameId} />

                <h3 className="configSubheading">Task templates (from game exceptions)</h3>
                <p className="muted" style={{ marginBottom: 12 }}>
                    Used when creating tasks from the dashboard exception detail. <strong>Title:</strong>{' '}
                    <code>&lt;EXCEPTION_INDEX&gt;</code> (server-sequenced per game), <code>&lt;EXCEPTION_ID&gt;</code>,{' '}
                    <code>&lt;EXCEPTION_SHORT_ID&gt;</code>, <code>&lt;SHORT_ERROR_MESSAGE&gt;</code> (from the
                    client/ingest field) — <code>&lt;ERROR_MESSAGE&gt;</code> is removed from titles if present.{' '}
                    <strong>Description:</strong> <code>&lt;EXCEPTION_TRACE&gt;</code> for the stack trace, plus{' '}
                    <code>&lt;EXCEPTION_ID&gt;</code>, <code>&lt;EXCEPTION_SHORT_ID&gt;</code>,{' '}
                    <code>&lt;ERROR_MESSAGE&gt;</code>, <code>&lt;SHORT_ERROR_MESSAGE&gt;</code>;{' '}
                    <code>&lt;EXCEPTION_INDEX&gt;</code> is stripped in descriptions. Add your own markdown fences
                    around the trace if you want a code block.
                </p>
                <div className="modalFormGrid" style={{ marginBottom: 14, maxWidth: 720 }}>
                    <label className="tasksListToolbarLabel" htmlFor="exc-task-title-tpl">
                        Title template
                    </label>
                    <input
                        id="exc-task-title-tpl"
                        className="textInput"
                        value={exceptionTitleTemplate}
                        onChange={(e) => setExceptionTitleTemplate(e.target.value)}
                        autoComplete="off"
                        aria-label="Title template for exception tasks"
                    />
                    <label className="tasksListToolbarLabel" htmlFor="exc-task-desc-tpl">
                        Description template
                    </label>
                    <textarea
                        id="exc-task-desc-tpl"
                        className="textArea modalTaskDescArea"
                        style={{ minHeight: '6rem' }}
                        value={exceptionDescriptionTemplate}
                        onChange={(e) => setExceptionDescriptionTemplate(e.target.value)}
                        aria-label="Description template for exception tasks"
                    />
                    <label className="tasksListToolbarLabel" htmlFor="exc-task-default-cat">
                        Default category for new exception tasks
                    </label>
                    <select
                        id="exc-task-default-cat"
                        className="intervalSelect"
                        style={{ maxWidth: 360 }}
                        value={exceptionTemplateCategoryId ?? ''}
                        onChange={(e) => {
                            const v = e.target.value
                            setExceptionTemplateCategoryId(v.length ? v : null)
                        }}
                        aria-label="Default category for tasks created from exceptions"
                    >
                        <option value="">None</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>

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
