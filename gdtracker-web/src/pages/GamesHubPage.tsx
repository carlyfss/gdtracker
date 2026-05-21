import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { describeApiError } from '../api/errors'
import {
    createGame,
    listDeletedGames,
    listGames,
    restoreGame,
    type DeletedGameSummary,
    type GameSummary,
} from '../api/games'
import { AppAuthenticatedShell } from '../components/AppAuthenticatedShell'
import { PermanentDeleteGameModal } from '../components/PermanentDeleteGameModal'

function deletedGameStats(g: DeletedGameSummary): string {
    const parts = [
        `${g.taskCount} task${g.taskCount === 1 ? '' : 's'}`,
        `${g.exceptionCount} exception${g.exceptionCount === 1 ? '' : 's'}`,
        `${g.documentCount} document${g.documentCount === 1 ? '' : 's'}`,
    ]
    return parts.join(' · ')
}

export function GamesHubPage() {
    const navigate = useNavigate()
    const [games, setGames] = useState<GameSummary[]>([])
    const [deletedGames, setDeletedGames] = useState<DeletedGameSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)
    const [newName, setNewName] = useState('')
    const [purgeTarget, setPurgeTarget] = useState<DeletedGameSummary | null>(null)
    const [restoringId, setRestoringId] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const [active, deleted] = await Promise.all([listGames(), listDeletedGames()])
            setGames(active)
            setDeletedGames(deleted)
            if (active.length === 0 && deleted.length === 0) {
                navigate('/games/new', { replace: true })
            }
        } catch (err) {
            setError(describeApiError(err, 'Could not load games.'))
            setGames([])
            setDeletedGames([])
        } finally {
            setLoading(false)
        }
    }, [navigate])

    useEffect(() => {
        const t = window.setTimeout(() => {
            void refresh()
        }, 0)
        return () => window.clearTimeout(t)
    }, [refresh])

    const onCreateInline = async (e: React.FormEvent) => {
        e.preventDefault()
        const name = newName.trim()
        if (!name) return
        setCreating(true)
        setError(null)
        try {
            const g = await createGame(name)
            setNewName('')
            navigate(`/g/${encodeURIComponent(g.id)}/dashboard`, { replace: false })
        } catch (err) {
            setError(describeApiError(err, 'Failed to create game.'))
            if (import.meta.env.DEV) {
                console.error('createGame failed', err)
            }
        } finally {
            setCreating(false)
        }
    }

    const onRestore = async (g: DeletedGameSummary) => {
        const ok = window.confirm(`Restore game "${g.name}"? It will reappear in your active games list.`)
        if (!ok) return
        setRestoringId(g.id)
        setError(null)
        try {
            await restoreGame(g.id)
            await refresh()
        } catch (err) {
            setError(describeApiError(err, 'Failed to restore game.'))
        } finally {
            setRestoringId(null)
        }
    }

    const showHubContent = !loading && (games.length > 0 || deletedGames.length > 0)

    return (
        <AppAuthenticatedShell sidebarNav={null} sidebarNavLabel="Game hub" mainAriaLabel="Games list">
            <div className="gamesHub">
                <header className="gamesHubIntro">
                    <h1 className="gamesHubTitle">Your games</h1>
                    <p className="gamesHubSubtitle">Choose a game to open the dashboard, or create a new one.</p>
                </header>
                {error && <div className="banner bannerError">{error}</div>}
                {loading && <p className="fullScreenGateText">Loading games…</p>}
                {showHubContent && (
                    <>
                        {games.length > 0 && (
                            <>
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <Link className="appNavLink" data-active="false" to="/games/new">
                                        New game
                                    </Link>
                                </div>
                                <div className="gamesList" aria-label="Games">
                                    {games.map((g) => (
                                        <Link
                                            key={g.id}
                                            className="gamesListItem"
                                            to={`/g/${encodeURIComponent(g.id)}/dashboard`}
                                        >
                                            <span style={{ fontWeight: 650 }}>{g.name}</span>
                                            <span style={{ fontSize: 12, opacity: 0.75 }}>Open</span>
                                        </Link>
                                    ))}
                                </div>
                            </>
                        )}
                        {games.length === 0 && deletedGames.length > 0 && (
                            <p className="muted" style={{ margin: '0 0 16px' }}>
                                No active games. Restore a deleted game below or create a new one.
                            </p>
                        )}
                        <section className="card" style={{ marginTop: 24 }}>
                            <div className="cardHeader">
                                <h2 className="cardTitle">Quick create</h2>
                            </div>
                            <div className="cardBody">
                                <form onSubmit={onCreateInline} className="formGrid" style={{ alignItems: 'end' }}>
                                    <div className="authField" style={{ marginBottom: 0 }}>
                                        <label className="authLabel" htmlFor="quick-game-name">
                                            Game name
                                        </label>
                                        <input
                                            id="quick-game-name"
                                            className="authInput"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            placeholder="e.g. Production build"
                                        />
                                    </div>
                                    <button type="submit" className="authPrimaryButton" disabled={creating}>
                                        Create and open
                                    </button>
                                </form>
                            </div>
                        </section>
                        {deletedGames.length > 0 && (
                            <section className="card dangerZone" style={{ marginTop: 24 }}>
                                <div className="cardHeader">
                                    <h2 className="cardTitle">Deleted games</h2>
                                </div>
                                <div className="cardBody">
                                    <p className="muted" style={{ marginTop: 0 }}>
                                        Soft-deleted games can be restored or permanently removed. Permanent deletion
                                        cannot be undone.
                                    </p>
                                    <div className="deletedGamesList" aria-label="Deleted games">
                                        {deletedGames.map((g) => (
                                            <div key={g.id} className="deletedGamesRow">
                                                <div className="deletedGamesRowMain">
                                                    <span className="deletedGamesRowName">{g.name}</span>
                                                    <span className="deletedGamesRowStats muted">
                                                        {deletedGameStats(g)}
                                                    </span>
                                                </div>
                                                <div className="deletedGamesRowActions">
                                                    <button
                                                        type="button"
                                                        className="btn"
                                                        disabled={restoringId === g.id}
                                                        onClick={() => void onRestore(g)}
                                                    >
                                                        {restoringId === g.id ? 'Restoring…' : 'Restore'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btnDanger"
                                                        onClick={() => setPurgeTarget(g)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        )}
                    </>
                )}
            </div>
            <PermanentDeleteGameModal
                key={purgeTarget?.id ?? 'closed'}
                open={purgeTarget != null}
                gameId={purgeTarget?.id ?? null}
                gameName={purgeTarget?.name}
                onClose={() => setPurgeTarget(null)}
                onDeleted={() => void refresh()}
            />
        </AppAuthenticatedShell>
    )
}
