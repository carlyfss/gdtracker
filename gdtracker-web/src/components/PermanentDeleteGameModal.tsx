import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { describeApiError } from '../api/errors'
import { getGamePurgePreview, permanentlyDeleteGame, type GamePurgePreview } from '../api/games'

type Props = {
    open: boolean
    gameId: string | null
    gameName?: string
    onClose: () => void
    onDeleted: () => void
}

function PurgeList({ title, items, more }: { title: string; items: string[]; more: number }) {
    return (
        <div className="purgePreviewBlock">
            <div className="purgePreviewBlockTitle">{title}</div>
            {items.length === 0 ? (
                <p className="muted purgePreviewEmpty">None</p>
            ) : (
                <ul className="purgePreviewList">
                    {items.map((name, i) => (
                        <li key={`${title}-${i}-${name}`}>{name}</li>
                    ))}
                </ul>
            )}
            {more > 0 ? <p className="muted purgePreviewMore">+ {more} more</p> : null}
        </div>
    )
}

export function PermanentDeleteGameModal({ open, gameId, gameName, onClose, onDeleted }: Props) {
    const [preview, setPreview] = useState<GamePurgePreview | null>(null)
    const [loading, setLoading] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!open || !gameId) return
        let cancelled = false
        void (async () => {
            setLoading(true)
            setError(null)
            try {
                const data = await getGamePurgePreview(gameId)
                if (!cancelled) setPreview(data)
            } catch (err) {
                if (!cancelled) {
                    setPreview(null)
                    setError(describeApiError(err, 'Could not load delete preview.'))
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [open, gameId])

    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !busy) onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, busy, onClose])

    const onPermanentDelete = async () => {
        if (!gameId) return
        setBusy(true)
        setError(null)
        try {
            await permanentlyDeleteGame(gameId)
            onClose()
            onDeleted()
        } catch (err) {
            setError(describeApiError(err, 'Failed to permanently delete game.'))
        } finally {
            setBusy(false)
        }
    }

    if (!open || !gameId) return null

    const displayName = preview?.gameName ?? gameName ?? 'this game'

    return createPortal(
        <div
            className="modalBackdrop"
            onClick={() => {
                if (!busy) onClose()
            }}
            role="presentation"
        >
            <div
                className="modalCard modalCardDanger"
                role="dialog"
                aria-modal="true"
                aria-labelledby="permanent-delete-game-title"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="modalTitle" id="permanent-delete-game-title">
                    Permanently delete “{displayName}”?
                </h3>
                <p className="purgePreviewWarning">
                    This action cannot be undone. All game data listed below will be removed permanently.
                </p>
                {loading && <p className="muted">Loading preview…</p>}
                {error && <div className="banner bannerError">{error}</div>}
                {preview && !loading && (
                    <div className="purgePreviewGrid">
                        <PurgeList title="Features" items={preview.features} more={preview.featuresMore} />
                        <PurgeList title="Tasks" items={preview.tasks} more={preview.tasksMore} />
                        <PurgeList title="Documents" items={preview.documents} more={preview.documentsMore} />
                    </div>
                )}
                <div className="modalFooter">
                    <button type="button" className="btn" disabled={busy} onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn btnDanger"
                        disabled={busy || loading || !preview}
                        onClick={() => void onPermanentDelete()}
                    >
                        {busy ? 'Deleting…' : 'Delete permanently'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
