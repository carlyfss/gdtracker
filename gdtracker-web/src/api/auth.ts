import { api } from './client'

export type AuthUser = {
    id: string
    username: string
}

export async function getMe(): Promise<AuthUser | null> {
    const res = await api.get<AuthUser>('/api/auth/me', {
        validateStatus: (status) => status === 200 || status === 401,
    })
    if (res.status === 401) return null
    return res.data
}

export async function login(username: string, password: string): Promise<AuthUser> {
    const res = await api.post<AuthUser>('/api/auth/login', { username, password })
    return res.data
}

export async function register(username: string, password: string): Promise<AuthUser> {
    const res = await api.post<AuthUser>('/api/auth/register', { username, password })
    return res.data
}

export async function logout(): Promise<void> {
    await api.post('/api/auth/logout')
}
