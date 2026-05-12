import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { setApiUnauthorizedHandler } from '../api/apiUnauthorized'
import { useAuth } from '../context/AuthContext'

/** Wires session expiry from API 401 responses to client state + login route (see `api/client.ts`). */
export function ApiUnauthorizedBridge() {
    const navigate = useNavigate()
    const { logout } = useAuth()
    const handling = useRef(false)

    useEffect(() => {
        setApiUnauthorizedHandler(() => {
            if (handling.current) {
                return
            }
            handling.current = true
            void (async () => {
                try {
                    await logout()
                } catch {
                    /* ignore */
                } finally {
                    navigate('/login', { replace: true })
                }
            })()
        })
        return () => {
            setApiUnauthorizedHandler(null)
        }
    }, [logout, navigate])

    return null
}
