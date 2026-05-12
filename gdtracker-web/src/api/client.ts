import axios, { isAxiosError } from 'axios'
import { notifyApiUnauthorized } from './apiUnauthorized'

let csrfTokenOverride: string | null = null

async function primeCsrf(): Promise<void> {
    try {
        const res = await api.get<{ token: string }>('/api/csrf')
        csrfTokenOverride = res.data?.token ?? null
    } catch {
        // If the endpoint is unreachable (dev proxy not running, etc.), we'll fall back to cookie-based CSRF.
    }
}

function readCookie(name: string): string | null {
    const prefix = `${name}=`
    const parts = document.cookie.split(';')
    for (const part of parts) {
        const trimmed = part.trim()
        if (trimmed.startsWith(prefix)) {
            return decodeURIComponent(trimmed.slice(prefix.length))
        }
    }
    return null
}

const productionBaseURL = import.meta.env.VITE_API_BASE_URL ?? ''
if (!import.meta.env.DEV && !productionBaseURL) {
    console.error(
        'VITE_API_BASE_URL is not set. The production build cannot reach the API; ' +
            'requests will be sent to the page origin.'
    )
}

export const api = axios.create({
    baseURL: import.meta.env.DEV ? '' : productionBaseURL,
    withCredentials: true,
})

// In cross-subdomain deployments (e.g. dashboard.* -> api.*), the SPA cannot read the API's XSRF cookie via document.cookie.
// Prime once so subsequent mutating requests can send the header even when the cookie isn't readable on the SPA origin.
void primeCsrf()

function shouldNotifyUnauthorized(url: string): boolean {
    if (!url.startsWith('/api/')) {
        return false
    }
    if (
        url === '/api/auth/me' ||
        url === '/api/auth/login' ||
        url === '/api/auth/register' ||
        url === '/api/auth/logout' ||
        url === '/api/csrf'
    ) {
        return false
    }
    return true
}

api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (isAxiosError(err) && err.response?.status === 401) {
            const url = err.config?.url ?? ''
            if (shouldNotifyUnauthorized(url)) {
                notifyApiUnauthorized()
            }
        }
        return Promise.reject(err)
    }
)

api.interceptors.request.use((config) => {
    const url = config.url ?? ''
    const isAuthEndpoint = url === '/api/auth/login' || url === '/api/auth/register'

    const token = readCookie('XSRF-TOKEN') ?? csrfTokenOverride
    if (token && !isAuthEndpoint) {
        config.headers = config.headers ?? {}
        config.headers['X-XSRF-TOKEN'] = token
    }
    return config
})
