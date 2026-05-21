import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { describeApiError } from '../../../api/errors'
import { softDeleteGame } from '../../../api/games'

export function GameDeleteSection({ gameId }: { gameId: string }) {
    const navigate = useNavigate()
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!confirmOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !busy) setConfirmOpen(false)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [confirmOpen, busy])

    const onConfirmDelete = async () => {
        setBusy(true)
        setError(null)
        try {
            await softDeleteGame(gameId)
            setConfirmOpen(false)
            navigate('/games', { replace: true })
        } catch (err) {
            setError(describeApiError(err, 'Failed to delete game.'))
        } finally {
            setBusy(false)
        }
    }

    return (
        <>
            <section className="gamePageSection dangerZone">
                <div className="cardHeader">
                    <h2 className="cardTitle">Danger zone</h2>
                </div>
                <div className="cardBody">
                    <p className="muted" style={{ marginTop: 0 }}>
                        Deleting this game moves it to the deleted games list on the games hub. You can restore it later
                        or permanently remove it from there. Dashboard access for this game ends immediately.
                    </p>
                    <button type="button" className="btn btnDanger" onClick={() => setConfirmOpen(true)}>
                        Delete game
                    </button>
                </div>
            </section>

            {confirmOpen &&
                createPortal(
                    <div
                        className="modalBackdrop"
                        onClick={() => {
                            if (!busy) setConfirmOpen(false)
                        }}
                        role="presentation"
                    >
                        <div
                            className="modalCard modalCardDanger"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="game-delete-confirm-title"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="modalTitle" id="game-delete-confirm-title">
                                Delete this game?
                            </h3>
                            <p className="muted" style={{ margin: '0 0 14px', lineHeight: 1.45 }}>
                                The game will be removed from your active list and moved to deleted games. You can
                                restore it from the games hub unless you permanently delete it later.
                            </p>
                            {error && <div className="banner bannerError">{error}</div>}
                            <div className="modalFooter">
                                <button
                                    type="button"
                                    className="btn"
                                    disabled={busy}
                                    onClick={() => setConfirmOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btnDanger"
                                    disabled={busy}
                                    onClick={() => void onConfirmDelete()}
                                >
                                    {busy ? 'Deleting…' : 'Delete game'}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </>
    )
}
