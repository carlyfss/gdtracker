import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { listGames } from '../api/games'
import { isAuth0Mode } from '../config/authMode'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
    const { user, loading, login, register } = useAuth()
    const navigate = useNavigate()
    const [mode, setMode] = useState<'login' | 'register'>('login')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    if (!loading && user) {
        return <Navigate to="/games" replace />
    }

    const afterAuth = async () => {
        const games = await listGames()
        if (games.length === 0) {
            navigate('/games/new', { replace: true })
        } else {
            navigate('/games', { replace: true })
        }
    }

    const onAuth0SignIn = async () => {
        setError(null)
        setBusy(true)
        try {
            await login('', '')
            await afterAuth()
        } catch {
            /* Auth0 redirect in progress */
        } finally {
            setBusy(false)
        }
    }

    const onAuth0Register = async () => {
        setError(null)
        setBusy(true)
        try {
            await register('', '')
            await afterAuth()
        } catch {
            /* Auth0 redirect in progress */
        } finally {
            setBusy(false)
        }
    }

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        const u = username.trim()
        const p = password
        if (!u || !p) {
            setError('Enter username and password.')
            return
        }
        setBusy(true)
        try {
            if (mode === 'login') {
                await login(u, p)
            } else {
                await register(u, p)
            }
            await afterAuth()
        } catch {
            setError(mode === 'login' ? 'Login failed.' : 'Registration failed (username may be taken).')
        } finally {
            setBusy(false)
        }
    }

    if (loading) {
        return (
            <div className="fullScreenGate">
                <p className="fullScreenGateText">Loading…</p>
            </div>
        )
    }

    if (isAuth0Mode()) {
        return (
            <div className="fullScreenGate">
                <div className="authSurface">
                    <h1 className="authTitle">{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
                    <p className="authSubtitle">
                        Production sign-in uses Auth0 (username and password). You will be redirected to the login page.
                    </p>
                    {error && <p className="authError">{error}</p>}
                    <div className="authActions">
                        <button
                            type="button"
                            className="authPrimaryButton"
                            disabled={busy}
                            onClick={() => void (mode === 'login' ? onAuth0SignIn() : onAuth0Register())}
                        >
                            {mode === 'login' ? 'Sign in' : 'Register'}
                        </button>
                        <button
                            type="button"
                            className="authSecondaryButton"
                            onClick={() => {
                                setMode(mode === 'login' ? 'register' : 'login')
                                setError(null)
                            }}
                        >
                            {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="fullScreenGate">
            <div className="authSurface">
                <h1 className="authTitle">{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
                <p className="authSubtitle">
                    Local testing only — passwords are not encrypted in storage. Use a throwaway username.
                </p>
                {error && <p className="authError">{error}</p>}
                <form onSubmit={onSubmit}>
                    <div className="authField">
                        <label className="authLabel" htmlFor="auth-username">
                            Username
                        </label>
                        <input
                            id="auth-username"
                            className="authInput"
                            autoComplete="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>
                    <div className="authField">
                        <label className="authLabel" htmlFor="auth-password">
                            Password
                        </label>
                        <input
                            id="auth-password"
                            className="authInput"
                            type="password"
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <div className="authActions">
                        <button type="submit" className="authPrimaryButton" disabled={busy}>
                            {mode === 'login' ? 'Sign in' : 'Register'}
                        </button>
                        <button
                            type="button"
                            className="authSecondaryButton"
                            onClick={() => {
                                setMode(mode === 'login' ? 'register' : 'login')
                                setError(null)
                            }}
                        >
                            {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
