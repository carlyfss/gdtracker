import { Auth0Provider } from '@auth0/auth0-react'
import type { ReactNode } from 'react'
import { auth0Config, isAuth0Mode } from '../config/authMode'
import { Auth0AuthProvider } from './Auth0AuthProvider'
import { SessionAuthProvider } from './AuthContext'

export function AuthRootProvider({ children }: { children: ReactNode }) {
    if (!isAuth0Mode()) {
        return <SessionAuthProvider>{children}</SessionAuthProvider>
    }

    const cfg = auth0Config()
    if (!cfg) {
        return (
            <div className="fullScreenGate">
                <p className="fullScreenGateText">Auth0 is not configured. Check VITE_AUTH0_* env vars.</p>
            </div>
        )
    }

    return (
        <Auth0Provider
            domain={cfg.domain}
            clientId={cfg.clientId}
            authorizationParams={{
                redirect_uri: window.location.origin,
                audience: cfg.audience,
            }}
            cacheLocation="localstorage"
        >
            <Auth0AuthProvider>{children}</Auth0AuthProvider>
        </Auth0Provider>
    )
}
