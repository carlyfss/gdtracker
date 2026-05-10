import { useCallback, useEffect, useState } from 'react'
import type { GameEventDefinition } from '../../../api/gameEvents'
import {
    createGameEventDefinition,
    deleteGameEventDefinition,
    getIngestTokenStatus,
    listGameEventDefinitions,
    regenerateIngestToken,
    updateGameEventDefinition,
} from '../../../api/gameEvents'
import { IconEdit, IconTrash } from '../../../components/icons'
import { isHex6, normalizeHex6 } from '../../../util/hexColor'
import { DEFAULT_COLOR, isAxiosStatus, normalizeHexColor, type UiState } from '../configurationUtils'

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
    return normalizeHex6(d.color, DEFAULT_COLOR)
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

export function GameEventsSection({ gameId }: { gameId: string }) {
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
                                value={isHex6(createColor) ? createColor : DEFAULT_COLOR}
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
                                                        value={isHex6(editingColor) ? editingColor : DEFAULT_COLOR}
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
