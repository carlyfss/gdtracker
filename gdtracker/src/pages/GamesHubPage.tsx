import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { describeApiError } from '../api/errors'
import { createGame, listGames, type GameSummary } from '../api/games'
import { useAuth } from '../context/AuthContext'

export function GamesHubPage() {
    const { logout } = useAuth()
    const navigate = useNavigate()
    const [games, setGames] = useState<GameSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)
    const [newName, setNewName] = useState('')

    const refresh = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const list = await listGames()
            setGames(list)
            if (list.length === 0) {
                navigate('/games/new', { replace: true })
            }
        } catch (err) {
            setError(describeApiError(err, 'Could not load games.'))
            setGames([])
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

    return (
        <div className="appShell">
            <header className="appHeader">
                <div className="appHeaderInner" style={{ gridTemplateColumns: '1fr auto' }}>
                    <div className="appBrand">
                        <h1 className="appTitle">Your games</h1>
                        <div className="appSubtitle">Choose a game to open the dashboard, or create a new one.</div>
                    </div>
                    <div className="appHeaderActions">
                        <button
                            type="button"
                            className="appLogoutButton"
                            onClick={() => {
                                void (async () => {
                                    await logout()
                                    navigate('/login', { replace: true })
                                })()
                            }}
                        >
                            Log out
                        </button>
                    </div>
                </div>
            </header>
            <main className="appMain">
                <div className="gamesHub">
                    {error && <div className="banner bannerError">{error}</div>}
                    {loading && <p className="fullScreenGateText">Loading games…</p>}
                    {!loading && games.length > 0 && (
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
                        </>
                    )}
                </div>
            </main>
        </div>
    )
}
