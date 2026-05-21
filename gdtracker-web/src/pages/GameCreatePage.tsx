import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { describeApiError } from '../api/errors'
import { createGame, listGames } from '../api/games'
import { AppAuthenticatedShell } from '../components/AppAuthenticatedShell'

export function GameCreatePage() {
    const navigate = useNavigate()
    const [name, setName] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [priming, setPriming] = useState(true)

    useEffect(() => {
        let cancelled = false
        void (async () => {
            try {
                await listGames()
                if (!cancelled) {
                    setError(null)
                }
            } catch (err) {
                if (!cancelled) {
                    setError(
                        describeApiError(
                            err,
                            'Could not reach the server to prepare your session. Try refreshing or sign in again.'
                        )
                    )
                }
            } finally {
                if (!cancelled) {
                    setPriming(false)
                }
            }
        })()
        return () => {
            cancelled = true
        }
    }, [])

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const trimmed = name.trim()
        if (!trimmed) {
            setError('Enter a game name.')
            return
        }
        setBusy(true)
        setError(null)
        try {
            const g = await createGame(trimmed)
            navigate(`/g/${encodeURIComponent(g.id)}/dashboard`, { replace: true })
        } catch (err) {
            setError(describeApiError(err, 'Could not create the game.'))
            if (import.meta.env.DEV) {
                console.error('createGame failed', err)
            }
        } finally {
            setBusy(false)
        }
    }

    return (
        <AppAuthenticatedShell
            sidebarNav={null}
            sidebarNavLabel="Game hub"
            mainAriaLabel="Create game"
            breadcrumbs={[{ label: 'Games', to: '/games' }, { label: 'New game' }]}
        >
            <div className="appMainInner gameCreateMain">
                <div className="authSurface" style={{ width: 'min(520px, 100%)' }}>
                    <h1 className="authTitle">Create a game</h1>
                    <p className="authSubtitle">
                        Games separate exceptions, traces, tasks, and configuration. You can switch games any time from
                        the games hub.
                    </p>
                    {error && <p className="authError">{error}</p>}
                    <form onSubmit={onSubmit}>
                        <div className="authField">
                            <label className="authLabel" htmlFor="game-name">
                                Game name
                            </label>
                            <input
                                id="game-name"
                                className="authInput"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                                placeholder="e.g. Main project"
                                disabled={priming}
                            />
                        </div>
                        <div className="authActions">
                            <button type="submit" className="authPrimaryButton" disabled={busy || priming}>
                                {priming ? 'Preparing…' : busy ? 'Creating…' : 'Create game'}
                            </button>
                            <button
                                type="button"
                                className="authSecondaryButton"
                                onClick={() => navigate('/games', { replace: false })}
                            >
                                Back to games
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </AppAuthenticatedShell>
    )
}
