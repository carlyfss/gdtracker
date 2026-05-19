import { useCallback, useEffect, useState } from 'react'
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
    const [flagRows, setFlagRows] = useState<FlagRow[]>([])
    const [settingRows, setSettingRows] = useState<SettingRow[]>([])

    const load = useCallback(async () => {
        setState({ kind: 'loading', message: 'Loading configuration…' })
        try {
            const cfg = await getConfiguration(gameId)
            setFlagRows(rowsFromFlags(cfg.featureFlags ?? {}))
            setSettingRows(rowsFromSettings(cfg.settings ?? {}))
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
            })
            setFlagRows(rowsFromFlags(updated.featureFlags ?? {}))
            setSettingRows(rowsFromSettings(updated.settings ?? {}))
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
