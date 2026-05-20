export type AuthMode = 'session' | 'auth0'

export function authMode(): AuthMode {
    const raw = (import.meta.env.VITE_AUTH_MODE ?? 'session').toLowerCase()
    return raw === 'auth0' ? 'auth0' : 'session'
}

export function isAuth0Mode(): boolean {
    return authMode() === 'auth0'
}

export function auth0Config(): { domain: string; clientId: string; audience: string } | null {
    if (!isAuth0Mode()) {
        return null
    }
    const domain = import.meta.env.VITE_AUTH0_DOMAIN?.trim() ?? ''
    const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID?.trim() ?? ''
    const audience = import.meta.env.VITE_AUTH0_AUDIENCE?.trim() ?? ''
    if (!domain || !clientId || !audience) {
        console.error(
            'VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID, and VITE_AUTH0_AUDIENCE are required when VITE_AUTH_MODE=auth0'
        )
        return null
    }
    return { domain, clientId, audience }
}
