import { useCallback, useEffect, useState } from 'react'
import type { GameEventDefinition } from '../../../api/gameEvents'
import {
    createGameEventDefinition,
    deleteGameEventDefinition,
    listGameEventDefinitions,
    updateGameEventDefinition,
} from '../../../api/gameEvents'
import { IconEdit, IconTrash } from '../../../components/icons'
import { isHex6, normalizeHex6 } from '../../../util/hexColor'
import {
    buildExamplePayloadForSave,
    extractPlaceholderTokens,
    MAX_GAME_EVENT_TEMPLATE_CHARS,
    randomSamplePlayerId,
    renderGameEventTemplate,
} from '../../../util/gameEventTemplate'
import { DEFAULT_COLOR, isAxiosStatus, normalizeHexColor, type UiState } from '../configurationUtils'

const GAME_EVENT_PLACEHOLDERS =
    'Placeholders use angle brackets and uppercase names, e.g. <PLAYER_ID>, <KEY>, <VALUE>, <MAP>, <X>, <Y>, <Z>. The game sends matching keys in parameters (keys are matched case-insensitively).'

const MAX_TEMPLATE_CHARS = MAX_GAME_EVENT_TEMPLATE_CHARS

const CREATE_EVENT_DEFINITION_SUBTITLE = `Message templates are at most ${MAX_TEMPLATE_CHARS} characters. ${GAME_EVENT_PLACEHOLDERS}`

function normalizeDefinitionCode(raw: string) {
    return raw.trim().toLowerCase().replace(/\s+/g, '_')
}

function definitionRowColor(d: { color?: string | null }) {
    return normalizeHex6(d.color, DEFAULT_COLOR)
}

function cardTitle(d: GameEventDefinition) {
    const name = typeof d.displayName === 'string' && d.displayName.trim().length > 0 ? d.displayName.trim() : null
    return name ?? d.code
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

function EventIcon({ imageData, color }: { imageData?: string | null; color?: string | null }) {
    if (!imageData) {
        return <span className="gameEventDefinitionCardIconPlaceholder">—</span>
    }
    const hex = color != null && String(color).trim() !== '' ? normalizeHex6(color, '') : ''
    if (hex) {
        return (
            <span
                className="gameEventDefinitionCardIconTinted"
                style={{
                    backgroundColor: hex,
                    WebkitMaskImage: `url(${imageData})`,
                    maskImage: `url(${imageData})`,
                }}
                role="img"
                aria-hidden
            />
        )
    }
    return (
        <img
            src={imageData}
            alt=""
            width={16}
            height={16}
            className="gameEventDefinitionCardIcon"
            style={{ imageRendering: 'pixelated' }}
        />
    )
}

export function GameEventsSection({ gameId }: { gameId: string }) {
    const [definitions, setDefinitions] = useState<GameEventDefinition[]>([])
    const [state, setState] = useState<UiState>({ kind: 'idle' })

    const [createCode, setCreateCode] = useState('')
    const [createDisplayName, setCreateDisplayName] = useState('')
    const [createTemplate, setCreateTemplate] = useState('')
    const [createImageData, setCreateImageData] = useState<string | null>(null)
    const [createColor, setCreateColor] = useState(DEFAULT_COLOR)
    const [createExamples, setCreateExamples] = useState<Record<string, string>>({})
    const [createPreviewPlayerId, setCreatePreviewPlayerId] = useState(() => randomSamplePlayerId())

    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingCode, setEditingCode] = useState('')
    const [editingDisplayName, setEditingDisplayName] = useState('')
    const [editingTemplate, setEditingTemplate] = useState('')
    const [editingImageData, setEditingImageData] = useState<string | null>(null)
    const [editingColor, setEditingColor] = useState(DEFAULT_COLOR)
    const [editingExamples, setEditingExamples] = useState<Record<string, string>>({})
    const [editingPreviewPlayerId, setEditingPreviewPlayerId] = useState(() => randomSamplePlayerId())

    const [previewPlayerIds, setPreviewPlayerIds] = useState<Record<string, string>>({})

    const load = useCallback(async () => {
        setState({ kind: 'loading', message: 'Loading game events…' })
        try {
            const defs = await listGameEventDefinitions(gameId)
            setDefinitions(defs)
            setPreviewPlayerIds((prev) => {
                const next = { ...prev }
                for (const d of defs) {
                    if (!next[d.id]) {
                        next[d.id] = randomSamplePlayerId()
                    }
                }
                return next
            })
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
                examplePlaceholderValues: buildExamplePayloadForSave(createTemplate, createExamples),
            })
            setCreateCode('')
            setCreateDisplayName('')
            setCreateTemplate('')
            setCreateImageData(null)
            setCreateColor(DEFAULT_COLOR)
            setCreateExamples({})
            setCreatePreviewPlayerId(randomSamplePlayerId())
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
        setEditingExamples({ ...(d.examplePlaceholderValues ?? {}) })
        setEditingPreviewPlayerId(randomSamplePlayerId())
    }

    const stopEdit = () => {
        setEditingId(null)
        setEditingCode('')
        setEditingDisplayName('')
        setEditingTemplate('')
        setEditingImageData(null)
        setEditingColor(DEFAULT_COLOR)
        setEditingExamples({})
        setEditingPreviewPlayerId(randomSamplePlayerId())
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
                examplePlaceholderValues: buildExamplePayloadForSave(editingTemplate, editingExamples),
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

    const resampleViewPlayerId = (definitionId: string) => {
        setPreviewPlayerIds((prev) => ({ ...prev, [definitionId]: randomSamplePlayerId() }))
    }

    const createTokens = extractPlaceholderTokens(createTemplate)
    const createMergedPreview = (): Record<string, string> => {
        const m = { ...createExamples }
        if (createTokens.includes('PLAYER_ID')) {
            m.PLAYER_ID = createPreviewPlayerId
        }
        return m
    }
    const createPreviewResult = renderGameEventTemplate(createTemplate, createMergedPreview())

    const editingTokens = editingId ? extractPlaceholderTokens(editingTemplate) : []
    const editingMergedPreview = (): Record<string, string> => {
        const m = { ...editingExamples }
        if (editingTokens.includes('PLAYER_ID')) {
            m.PLAYER_ID = editingPreviewPlayerId
        }
        return m
    }
    const editingPreviewResult = editingId
        ? renderGameEventTemplate(editingTemplate, editingMergedPreview())
        : { ok: false as const, error: '' }

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
                        </div>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 10 }}>
                        Template length: {createTemplate.length}/{MAX_TEMPLATE_CHARS}
                    </div>

                    {createTemplate.trim().length > 0 && (
                        <div className="gameEventDefinitionCard gameEventDefinitionCardNested">
                            <div className="gameEventDefinitionCardMainGrid">
                                <div className="gameEventDefinitionCardCol">
                                    <div className="gameEventDefinitionCardColLabel">Template</div>
                                    <div className="gameEventDefinitionCardPreviewRow">
                                        <EventIcon imageData={createImageData} color={normalizeHexColor(createColor)} />
                                        <span
                                            style={{ color: normalizeHexColor(createColor), wordBreak: 'break-word' }}
                                        >
                                            {createTemplate.trim()}
                                        </span>
                                    </div>
                                </div>
                                <div className="gameEventDefinitionCardCol gameEventDefinitionCardColCode">
                                    <div className="gameEventDefinitionCardColLabel">Code</div>
                                    <code className="gameEventDefinitionCardCode">
                                        {normalizeDefinitionCode(createCode) || '—'}
                                    </code>
                                </div>
                            </div>
                            <div className="gameEventDefinitionCardDivider" />
                            <div className="gameEventDefinitionExampleHead">
                                <span className="gameEventDefinitionCardColLabel" style={{ marginBottom: 0 }}>
                                    Example placeholders
                                </span>
                                <p className="gameEventDefinitionExampleHint">
                                    Set sample values for preview. &lt;PLAYER_ID&gt; uses a random sample (not saved).
                                </p>
                            </div>
                            <div className="gameEventDefinitionPlaceholderGrid">
                                {createTokens.map((token) =>
                                    token === 'PLAYER_ID' ? (
                                        <div key={token} className="gameEventDefinitionPlaceholderRow">
                                            <label className="gameEventDefinitionPlaceholderLabel">{`<${token}>`}</label>
                                            <span className="gameEventDefinitionPlaceholderRandomNote">
                                                Random sample: <code>{createPreviewPlayerId}</code>
                                                <button
                                                    type="button"
                                                    className="btn btnSmall gameEventDefinitionResampleBtn"
                                                    onClick={() => setCreatePreviewPlayerId(randomSamplePlayerId())}
                                                >
                                                    Resample
                                                </button>
                                            </span>
                                        </div>
                                    ) : (
                                        <div key={token} className="gameEventDefinitionPlaceholderRow">
                                            <label
                                                className="gameEventDefinitionPlaceholderLabel"
                                                htmlFor={`create-ph-${token}`}
                                            >
                                                {`<${token}>`}
                                            </label>
                                            <input
                                                id={`create-ph-${token}`}
                                                className="textInput"
                                                value={createExamples[token] ?? ''}
                                                onChange={(e) =>
                                                    setCreateExamples((prev) => ({
                                                        ...prev,
                                                        [token]: e.target.value,
                                                    }))
                                                }
                                                placeholder="Example value"
                                            />
                                        </div>
                                    )
                                )}
                            </div>
                            <div className="gameEventDefinitionCardDivider" />
                            <div className="gameEventDefinitionCardColLabel">Template example</div>
                            <div className="gameEventDefinitionCardPreviewRow">
                                <EventIcon imageData={createImageData} color={normalizeHexColor(createColor)} />
                                {createPreviewResult.ok ? (
                                    <span
                                        style={{
                                            color: normalizeHexColor(createColor),
                                            wordBreak: 'break-word',
                                        }}
                                    >
                                        {createPreviewResult.text}
                                    </span>
                                ) : (
                                    <span className="gameEventDefinitionPreviewError">{createPreviewResult.error}</span>
                                )}
                            </div>
                        </div>
                    )}
                    <button
                        type="button"
                        className="btn btnPrimary gameEventDefinitionCreateAddEvent"
                        disabled={!canCreate || state.kind === 'loading'}
                        onClick={() => void onCreate()}
                        aria-label="Add event"
                    >
                        Add Event
                    </button>
                </div>

                {definitions.length === 0 && state.kind !== 'loading' && (
                    <div className="emptyState">No game event definitions yet.</div>
                )}

                {definitions.length > 0 && (
                    <div className="gameEventDefinitionCardList">
                        {definitions.map((d) => {
                            const isEditing = editingId === d.id
                            const color = isEditing ? normalizeHexColor(editingColor) : definitionRowColor(d)
                            const tmpl = isEditing ? editingTemplate : d.messageTemplate
                            const codeStr = isEditing ? editingCode : d.code
                            const disp = isEditing
                                ? editingDisplayName
                                : typeof d.displayName === 'string'
                                  ? d.displayName
                                  : ''
                            const title = isEditing
                                ? editingDisplayName.trim() || normalizeDefinitionCode(editingCode) || '—'
                                : cardTitle(d)
                            const img = isEditing ? editingImageData : d.imageData
                            const examples = isEditing ? editingExamples : (d.examplePlaceholderValues ?? {})
                            const tokens = extractPlaceholderTokens(tmpl)
                            const samplePid = previewPlayerIds[d.id] ?? ''
                            const merged: Record<string, string> = { ...examples }
                            if (!isEditing && tokens.includes('PLAYER_ID') && samplePid) {
                                merged.PLAYER_ID = samplePid
                            }
                            const viewPreview = !isEditing ? renderGameEventTemplate(d.messageTemplate, merged) : null

                            return (
                                <div className="gameEventDefinitionCard" key={d.id}>
                                    <div className="gameEventDefinitionCardHeader">
                                        {isEditing ? (
                                            <input
                                                className="textInput gameEventDefinitionCardTitleInput"
                                                value={disp}
                                                onChange={(e) => setEditingDisplayName(e.target.value)}
                                                placeholder="Display name (title)"
                                                aria-label="Display name"
                                            />
                                        ) : (
                                            <h3 className="gameEventDefinitionCardTitle">{title}</h3>
                                        )}
                                        <div className="gameEventDefinitionCardActions">
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
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="gameEventDefinitionCardMainGrid">
                                        <div className="gameEventDefinitionCardCol">
                                            <div className="gameEventDefinitionCardColLabel">Template</div>
                                            {isEditing ? (
                                                <textarea
                                                    className="textArea gameEventDefinitionCardTemplateEdit"
                                                    value={editingTemplate}
                                                    onChange={(e) => setEditingTemplate(e.target.value)}
                                                    rows={2}
                                                    maxLength={MAX_TEMPLATE_CHARS}
                                                    aria-label="Edit template"
                                                />
                                            ) : (
                                                <div className="gameEventDefinitionCardPreviewRow">
                                                    <EventIcon imageData={img} color={color} />
                                                    <span style={{ color, wordBreak: 'break-word' }}>{tmpl}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="gameEventDefinitionCardCol gameEventDefinitionCardColCode">
                                            <div className="gameEventDefinitionCardColLabel">Code</div>
                                            {isEditing ? (
                                                <input
                                                    className="textInput"
                                                    value={editingCode}
                                                    onChange={(e) => setEditingCode(e.target.value)}
                                                    aria-label="Edit code"
                                                />
                                            ) : (
                                                <code className="gameEventDefinitionCardCode">
                                                    {normalizeDefinitionCode(codeStr)}
                                                </code>
                                            )}
                                        </div>
                                    </div>

                                    {isEditing && (
                                        <div className="gameEventDefinitionCardEditMeta">
                                            <div className="gameEventDefinitionCreateColorRow">
                                                <span>Color:</span>
                                                <input
                                                    type="color"
                                                    value={isHex6(editingColor) ? editingColor : DEFAULT_COLOR}
                                                    onChange={(e) => setEditingColor(e.target.value)}
                                                    title="Event color"
                                                    aria-label="Event color"
                                                />
                                                <span className="gameEventDefinitionCreateHex">
                                                    {normalizeHexColor(editingColor)}
                                                </span>
                                            </div>
                                            <label className="gameEventDefinitionIconPick">
                                                Icon (≤16×16)
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={(e) => void onPickIconEdit(e.target.files)}
                                                />
                                            </label>
                                        </div>
                                    )}

                                    <div className="gameEventDefinitionCardDivider" />

                                    {isEditing ? (
                                        <>
                                            <div className="gameEventDefinitionExampleHead">
                                                <span
                                                    className="gameEventDefinitionCardColLabel"
                                                    style={{ marginBottom: 0 }}
                                                >
                                                    Example placeholders
                                                </span>
                                                <p className="gameEventDefinitionExampleHint">
                                                    Sample values for preview. &lt;PLAYER_ID&gt; is random (not saved).
                                                </p>
                                            </div>
                                            <div className="gameEventDefinitionPlaceholderGrid">
                                                {editingTokens.map((token) =>
                                                    token === 'PLAYER_ID' ? (
                                                        <div key={token} className="gameEventDefinitionPlaceholderRow">
                                                            <label className="gameEventDefinitionPlaceholderLabel">
                                                                {`<${token}>`}
                                                            </label>
                                                            <span className="gameEventDefinitionPlaceholderRandomNote">
                                                                Random sample: <code>{editingPreviewPlayerId}</code>
                                                                <button
                                                                    type="button"
                                                                    className="btn btnSmall gameEventDefinitionResampleBtn"
                                                                    onClick={() =>
                                                                        setEditingPreviewPlayerId(
                                                                            randomSamplePlayerId()
                                                                        )
                                                                    }
                                                                >
                                                                    Resample
                                                                </button>
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div key={token} className="gameEventDefinitionPlaceholderRow">
                                                            <label
                                                                className="gameEventDefinitionPlaceholderLabel"
                                                                htmlFor={`edit-ph-${d.id}-${token}`}
                                                            >
                                                                {`<${token}>`}
                                                            </label>
                                                            <input
                                                                id={`edit-ph-${d.id}-${token}`}
                                                                className="textInput"
                                                                value={editingExamples[token] ?? ''}
                                                                onChange={(e) =>
                                                                    setEditingExamples((prev) => ({
                                                                        ...prev,
                                                                        [token]: e.target.value,
                                                                    }))
                                                                }
                                                                placeholder="Example value"
                                                            />
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                            <div className="gameEventDefinitionCardDivider" />
                                            <div className="gameEventDefinitionCardColLabel">Template example</div>
                                            <div className="gameEventDefinitionCardPreviewRow">
                                                <EventIcon
                                                    imageData={editingImageData}
                                                    color={normalizeHexColor(editingColor)}
                                                />
                                                {editingPreviewResult.ok ? (
                                                    <span
                                                        style={{
                                                            color: normalizeHexColor(editingColor),
                                                            wordBreak: 'break-word',
                                                        }}
                                                    >
                                                        {editingPreviewResult.text}
                                                    </span>
                                                ) : (
                                                    <span className="gameEventDefinitionPreviewError">
                                                        {editingPreviewResult.error}
                                                    </span>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="gameEventDefinitionExampleHead gameEventDefinitionExampleHeadReadonly">
                                                <span
                                                    className="gameEventDefinitionCardColLabel"
                                                    style={{ marginBottom: 0 }}
                                                >
                                                    Template example
                                                </span>
                                                {tokens.includes('PLAYER_ID') && (
                                                    <button
                                                        type="button"
                                                        className="btn btnSmall gameEventDefinitionResampleBtn"
                                                        onClick={() => resampleViewPlayerId(d.id)}
                                                    >
                                                        New sample PLAYER_ID
                                                    </button>
                                                )}
                                            </div>
                                            <div className="gameEventDefinitionCardPreviewRow">
                                                <EventIcon imageData={img} color={color} />
                                                {viewPreview && viewPreview.ok ? (
                                                    <span style={{ color, wordBreak: 'break-word' }}>
                                                        {viewPreview.text}
                                                    </span>
                                                ) : (
                                                    <span className="gameEventDefinitionPreviewError">
                                                        {viewPreview && !viewPreview.ok ? viewPreview.error : '—'}
                                                    </span>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </section>
    )
}
