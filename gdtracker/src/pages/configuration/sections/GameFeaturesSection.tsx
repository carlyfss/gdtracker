import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Feature } from '../../../api/features'
import { createFeature, deleteFeature, listFeatures, updateFeature } from '../../../api/features'
import type { TaskStatus } from '../../../api/tasks'
import { IconEdit, IconTrash } from '../../../components/icons'
import { descendantFeatureIds, depthForFeature, orderedFeatureTree } from '../../../util/featureTree'
import { isHex6, normalizeHex6 } from '../../../util/hexColor'
import { allStatus, statusLabel } from '../../../util/taskStatus'
import { DEFAULT_COLOR, isAxiosStatus, normalizeHexColor, normalizeName, type UiState } from '../configurationUtils'

function featureRowColor(f: Feature) {
    return normalizeHex6(f.color, DEFAULT_COLOR)
}

function featureParentOptionLabel(f: Feature, all: Feature[]): string {
    const d = depthForFeature(f.id, all)
    const indent = d > 0 ? `${'  '.repeat(d)}` : ''
    return `${indent}${f.name}`
}

export function GameFeaturesSection({ gameId }: { gameId: string }) {
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
                                                        value={isHex6(editingColor) ? editingColor : DEFAULT_COLOR}
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
