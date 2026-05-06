import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthUser } from '../api/auth'
import { getMe, login as apiLogin, logout as apiLogout, register as apiRegister } from '../api/auth'

type AuthContextValue = {
    user: AuthUser | null
    loading: boolean
    refresh: () => Promise<void>
    login: (username: string, password: string) => Promise<AuthUser>
    register: (username: string, password: string) => Promise<AuthUser>
    logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null)
    const [loading, setLoading] = useState(true)

    const refresh = useCallback(async () => {
        setLoading(true)
        try {
            const me = await getMe()
            setUser(me)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        const t = window.setTimeout(() => {
            void refresh()
        }, 0)
        return () => window.clearTimeout(t)
    }, [refresh])

    const login = useCallback(async (username: string, password: string) => {
        const u = await apiLogin(username, password)
        setUser(u)
        return u
    }, [])

    const register = useCallback(async (username: string, password: string) => {
        const u = await apiRegister(username, password)
        setUser(u)
        return u
    }, [])

    const logout = useCallback(async () => {
        try {
            await apiLogout()
        } catch {
            /* session may already be gone or CSRF blocked; still clear client state */
        } finally {
            setUser(null)
        }
    }, [])

    const value = useMemo(
        () => ({ user, loading, refresh, login, register, logout }),
        [user, loading, refresh, login, register, logout]
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext)
    if (!ctx) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return ctx
}
