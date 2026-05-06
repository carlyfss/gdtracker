import axios from 'axios'

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

api.interceptors.request.use((config) => {
    const token = readCookie('XSRF-TOKEN')
    if (token) {
        config.headers = config.headers ?? {}
        config.headers['X-XSRF-TOKEN'] = token
    }
    return config
})
