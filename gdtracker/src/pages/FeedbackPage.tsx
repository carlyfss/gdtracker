import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
    createGameFeedbackMeterDefinition,
    deleteGameFeedbackMeterDefinition,
    getGameFeedbackDetail,
    listGameFeedbackMeterDefinitions,
    listGameFeedbackSummaries,
    updateGameFeedbackMeterDefinition,
    type GameFeedbackDetail,
    type GameFeedbackMeterDefinition,
    type GameFeedbackSummary,
} from '../api/gameFeedback'
import { useGameId } from '../context/GameIdContext'

function normalizeFieldKey(raw: string): string {
    return raw.trim().toLowerCase().replace(/\s+/g, '_')
}

function FeedbackDetailModal({
    open,
    detail,
    loading,
    error,
    onClose,
}: {
    open: boolean
    detail: GameFeedbackDetail | null
    loading: boolean
    error: string | null
    onClose: () => void
}) {
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    if (!open) return null

    return createPortal(
        <div className="modalBackdrop" onClick={onClose} role="presentation">
            <div
                className="modalCard modalCardTask"
                role="dialog"
                aria-modal="true"
                aria-labelledby="feedback-detail-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modalTaskHeader">
                    <h3 className="modalTitle" id="feedback-detail-title">
                        Feedback
                    </h3>
                    <div className="modalHeaderTrailing">
                        <button type="button" className="modalCloseBtn" onClick={onClose} aria-label="Close dialog">
                            ×
                        </button>
                    </div>
                </div>
                <div className="modalTaskScroll">
                    {loading && <p className="muted">Loading…</p>}
                    {error && <p className="integrationWarn">{error}</p>}
                    {detail && !loading && !error && (
                        <div className="feedbackDetailBody">
                            <p className="feedbackDetailMeta">
                                <strong>Title:</strong> {detail.title}
                            </p>
                            <p className="feedbackDetailMeta">
                                <strong>Player id:</strong>{' '}
                                <code className="feedbackDetailCode">{detail.playerId}</code>
                            </p>
                            <p className="feedbackDetailMeta">
                                <strong>Received:</strong> {new Date(detail.createdAt).toLocaleString()}
                            </p>
                            <div className="feedbackDetailBlock">
                                <div className="feedbackDetailBlockTitle">Description</div>
                                <div className="feedbackDetailDescription">{detail.description}</div>
                            </div>
                            {detail.meters.length > 0 && (
                                <div className="feedbackDetailBlock">
                                    <div className="feedbackDetailBlockTitle">Meters (1–10)</div>
                                    <ul className="feedbackDetailMeters">
                                        {detail.meters.map((m) => (
                                            <li key={m.fieldKey}>
                                                <span className="feedbackDetailMeterQ">{m.question}</span>
                                                <span className="feedbackDetailMeterVal">{m.value}</span>
                                                <code className="feedbackDetailCode subtle">{m.fieldKey}</code>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="modalFooter">
                    <button type="button" className="btn" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}

export function FeedbackPage() {
    const gameId = useGameId()
    const [meters, setMeters] = useState<GameFeedbackMeterDefinition[]>([])
    const [summaries, setSummaries] = useState<GameFeedbackSummary[]>([])
    const [loadError, setLoadError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    const [fieldKey, setFieldKey] = useState('')
    const [question, setQuestion] = useState('')
    const [sortOrder, setSortOrder] = useState(0)
    const [editingId, setEditingId] = useState<string | null>(null)

    const [modalOpen, setModalOpen] = useState(false)
    const [modalDetail, setModalDetail] = useState<GameFeedbackDetail | null>(null)
    const [modalLoading, setModalLoading] = useState(false)
    const [modalError, setModalError] = useState<string | null>(null)

    const reload = useCallback(async () => {
        try {
            const [m, s] = await Promise.all([
                listGameFeedbackMeterDefinitions(gameId),
                listGameFeedbackSummaries(gameId),
            ])
            setMeters(m)
            setSummaries(s)
            setLoadError(null)
        } catch {
            setLoadError('Could not load feedback data.')
        }
    }, [gameId])

    useEffect(() => {
        let cancelled = false
        void Promise.all([listGameFeedbackMeterDefinitions(gameId), listGameFeedbackSummaries(gameId)]).then(
            ([m, s]) => {
                if (!cancelled) {
                    setMeters(m)
                    setSummaries(s)
                    setLoadError(null)
                }
            },
            () => {
                if (!cancelled) {
                    setLoadError('Could not load feedback data.')
                }
            }
        )
        return () => {
            cancelled = true
        }
    }, [gameId])

    const resetForm = () => {
        setEditingId(null)
        setFieldKey('')
        setQuestion('')
        setSortOrder(0)
    }

    const startEdit = (d: GameFeedbackMeterDefinition) => {
        setEditingId(d.id)
        setFieldKey(d.fieldKey)
        setQuestion(d.question)
        setSortOrder(d.sortOrder)
    }

    const submitMeter = async () => {
        const fk = normalizeFieldKey(fieldKey)
        const q = question.trim()
        if (!fk || !q) return
        setSaving(true)
        setLoadError(null)
        try {
            const body = { fieldKey: fk, question: q, sortOrder }
            if (editingId) {
                await updateGameFeedbackMeterDefinition(gameId, editingId, body)
            } else {
                await createGameFeedbackMeterDefinition(gameId, body)
            }
            resetForm()
            await reload()
        } catch {
            setLoadError('Could not save meter definition.')
        } finally {
            setSaving(false)
        }
    }

    const removeMeter = async (id: string) => {
        if (!window.confirm('Delete this meter field from the template?')) return
        setSaving(true)
        setLoadError(null)
        try {
            await deleteGameFeedbackMeterDefinition(gameId, id)
            if (editingId === id) resetForm()
            await reload()
        } catch {
            setLoadError('Could not delete meter definition.')
        } finally {
            setSaving(false)
        }
    }

    const openDetail = async (id: string) => {
        setModalOpen(true)
        setModalDetail(null)
        setModalError(null)
        setModalLoading(true)
        try {
            const d = await getGameFeedbackDetail(gameId, id)
            setModalDetail(d)
        } catch {
            setModalError('Could not load feedback.')
        } finally {
            setModalLoading(false)
        }
    }

    return (
        <div className="gamePageStack">
            <header className="integrationPageHeader">
                <h1 className="integrationPageTitle">Feedback</h1>
                <p className="integrationPageLead">
                    Configure 1–10 meter questions for in-game feedback, and review submissions from players.
                </p>
            </header>

            {loadError && <p className="integrationWarn">{loadError}</p>}

            <div className="feedbackPageSplit">
                <section className="gamePageSection">
                    <div className="cardHeader">
                        <h2 className="cardTitle">Template (meters)</h2>
                        <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
                            Each field has a question and a <code>fieldKey</code> used in the ingest JSON{' '}
                            <code>meters</code> object (values 1–10).
                        </p>
                    </div>
                    <div className="cardBody">
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table tableCompact">
                                <thead>
                                    <tr>
                                        <th>Question</th>
                                        <th>Field key</th>
                                        <th>Order</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {meters.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="muted">
                                                No meter fields yet. Add one below (optional; feedback can still be sent
                                                with title and description only when the template is empty).
                                            </td>
                                        </tr>
                                    ) : (
                                        meters.map((d) => (
                                            <tr key={d.id}>
                                                <td>{d.question}</td>
                                                <td>
                                                    <code>{d.fieldKey}</code>
                                                </td>
                                                <td>{d.sortOrder}</td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="btn"
                                                        disabled={saving}
                                                        onClick={() => startEdit(d)}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btnDanger"
                                                        disabled={saving}
                                                        onClick={() => void removeMeter(d.id)}
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="feedbackMeterForm">
                            <h3 className="feedbackFormTitle">{editingId ? 'Edit meter field' : 'Add meter field'}</h3>
                            <div className="modalFormGrid">
                                <label className="modalFieldLabel">
                                    Question
                                    <input
                                        className="textInput"
                                        value={question}
                                        onChange={(e) => setQuestion(e.target.value)}
                                        placeholder="How fun was the game?"
                                        maxLength={500}
                                    />
                                </label>
                                <label className="modalFieldLabel">
                                    Field key
                                    <input
                                        className="textInput"
                                        value={fieldKey}
                                        onChange={(e) => setFieldKey(e.target.value)}
                                        onBlur={() => setFieldKey((v) => normalizeFieldKey(v))}
                                        placeholder="game_fun"
                                        maxLength={64}
                                    />
                                </label>
                                <label className="modalFieldLabel">
                                    Sort order
                                    <input
                                        className="textInput"
                                        type="number"
                                        value={sortOrder}
                                        onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                                    />
                                </label>
                            </div>
                            <div className="inlineActions" style={{ marginTop: 12 }}>
                                <button
                                    type="button"
                                    className="btn btnPrimary"
                                    disabled={saving}
                                    onClick={submitMeter}
                                >
                                    {editingId ? 'Save changes' : 'Add field'}
                                </button>
                                {editingId && (
                                    <button type="button" className="btn" disabled={saving} onClick={resetForm}>
                                        Cancel edit
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="gamePageSection">
                    <div className="cardHeader">
                        <h2 className="cardTitle">Received feedback</h2>
                        <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
                            Title and player id; open a row for full detail.
                        </p>
                    </div>
                    <div className="cardBody">
                        <ul className="feedbackInboxList">
                            {summaries.length === 0 ? (
                                <li className="muted">No feedback yet.</li>
                            ) : (
                                summaries.map((s) => (
                                    <li key={s.id}>
                                        <button
                                            type="button"
                                            className="feedbackInboxRow"
                                            onClick={() => void openDetail(s.id)}
                                        >
                                            <span className="feedbackInboxTitle">{s.title}</span>
                                            <code className="feedbackInboxPlayer">{s.playerId}</code>
                                        </button>
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                </section>
            </div>

            <FeedbackDetailModal
                open={modalOpen}
                detail={modalDetail}
                loading={modalLoading}
                error={modalError}
                onClose={() => setModalOpen(false)}
            />
        </div>
    )
}
