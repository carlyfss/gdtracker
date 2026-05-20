import { useAuth0 } from '@auth0/auth0-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthUser } from '../api/auth'
import { getMe } from '../api/auth'
import { setAccessTokenGetter } from '../api/client'
import { AuthContext, type AuthContextValue } from './AuthContext'

export function Auth0AuthProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated, isLoading, loginWithRedirect, logout: auth0Logout, getAccessTokenSilently } = useAuth0()
    const [user, setUser] = useState<AuthUser | null>(null)
    const [loadingProfile, setLoadingProfile] = useState(true)

    useEffect(() => {
        setAccessTokenGetter(async () => {
            if (!isAuthenticated) {
                return null
            }
            try {
                return await getAccessTokenSilently()
            } catch {
                return null
            }
        })
        return () => {
            setAccessTokenGetter(null)
        }
    }, [getAccessTokenSilently, isAuthenticated])

    const refresh = useCallback(async () => {
        setLoadingProfile(true)
        try {
            if (!isAuthenticated) {
                setUser(null)
                return
            }
            const me = await getMe()
            setUser(me)
        } catch {
            setUser(null)
        } finally {
            setLoadingProfile(false)
        }
    }, [isAuthenticated])

    useEffect(() => {
        if (isLoading) {
            return
        }
        const t = window.setTimeout(() => {
            void refresh()
        }, 0)
        return () => window.clearTimeout(t)
    }, [isLoading, isAuthenticated, refresh])

    const logout = useCallback(async () => {
        setUser(null)
        await auth0Logout({
            logoutParams: {
                returnTo: `${window.location.origin}/login`,
            },
        })
    }, [auth0Logout])

    const recoverSession = useCallback(async () => {
        if (!isAuthenticated) {
            return false
        }
        try {
            await getAccessTokenSilently({ cacheMode: 'off' })
            const me = await getMe()
            setUser(me)
            return me !== null
        } catch {
            return false
        }
    }, [getAccessTokenSilently, isAuthenticated])

    const value = useMemo<AuthContextValue>(
        () => ({
            user,
            loading: isLoading || loadingProfile,
            refresh,
            login: async (username: string, password: string) => {
                void username
                void password
                await loginWithRedirect()
                throw new Error('redirecting to Auth0 login')
            },
            register: async (username: string, password: string) => {
                void username
                void password
                await loginWithRedirect({ authorizationParams: { screen_hint: 'signup' } })
                throw new Error('redirecting to Auth0 signup')
            },
            logout,
            recoverSession,
        }),
        [user, isLoading, loadingProfile, refresh, loginWithRedirect, logout, recoverSession]
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
