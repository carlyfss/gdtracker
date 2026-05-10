import axios from 'axios'

/**
 * Maps Axios HTTP failures to short user-facing messages (session / CSRF / server).
 */
export function describeApiError(err: unknown, fallback: string): string {
    if (!axios.isAxiosError(err)) {
        return fallback
    }
    const status = err.response?.status
    if (status === 401) {
        return 'Your session expired or you are not signed in. Please sign in again.'
    }
    if (status === 403) {
        return 'The request was blocked (often a missing security token). Refresh the page or sign in again.'
    }
    if (status != null && status >= 500) {
        return 'A server error occurred. Try again later.'
    }
    return fallback
}
