import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { setApiUnauthorizedHandler } from '../api/apiUnauthorized'
import { useAuth } from '../context/AuthContext'

/** Wires API 401 responses to client state + login route (see `api/client.ts`). */
export function ApiUnauthorizedBridge() {
    const navigate = useNavigate()
    const { logout, recoverSession } = useAuth()
    const handling = useRef(false)

    useEffect(() => {
        setApiUnauthorizedHandler(() => {
            if (handling.current) {
                return
            }
            handling.current = true
            void (async () => {
                try {
                    if (recoverSession) {
                        const recovered = await recoverSession()
                        if (recovered) {
                            handling.current = false
                            return
                        }
                    }
                    await logout()
                } catch {
                    /* ignore */
                } finally {
                    navigate('/login', { replace: true })
                    handling.current = false
                }
            })()
        })
        return () => {
            setApiUnauthorizedHandler(null)
        }
    }, [logout, navigate, recoverSession])

    return null
}
