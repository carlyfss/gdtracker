import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Category } from '../../../api/categories'
import { createCategory, deleteCategory, listCategories, updateCategory } from '../../../api/categories'
import { IconEdit, IconTrash } from '../../../components/icons'
import { isHex6, normalizeHex6 } from '../../../util/hexColor'
import { DEFAULT_COLOR, isAxiosStatus, normalizeHexColor, normalizeName, type UiState } from '../configurationUtils'

function categoryRowColor(c: Category) {
    return normalizeHex6(c.color, DEFAULT_COLOR)
}

export function GameCategoriesSection({
    gameId,
    onCategoriesChanged,
}: {
    gameId: string
    onCategoriesChanged: () => void
}) {
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
                                                        value={isHex6(editingColor) ? editingColor : DEFAULT_COLOR}
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
