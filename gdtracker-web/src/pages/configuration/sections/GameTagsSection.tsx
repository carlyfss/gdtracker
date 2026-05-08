import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Tag } from '../../../api/tags'
import { createTag, deleteTag, listTags, updateTag } from '../../../api/tags'
import { IconEdit, IconTrash } from '../../../components/icons'
import { chipTextColor } from '../../../util/chipTextColor'
import { isHex6, normalizeHex6 } from '../../../util/hexColor'
import { DEFAULT_COLOR, isAxiosStatus, normalizeHexColor, normalizeName, type UiState } from '../configurationUtils'

function tagRowColor(t: Tag) {
    return normalizeHex6(t.color, DEFAULT_COLOR)
}

export function GameTagsSection({ gameId }: { gameId: string }) {
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
                                                        value={isHex6(editingColor) ? editingColor : DEFAULT_COLOR}
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
