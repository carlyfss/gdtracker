import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth()
    const location = useLocation()

    if (loading) {
        return (
            <div className="fullScreenGate">
                <p className="fullScreenGateText">Loading…</p>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />
    }

    return <>{children}</>
}
