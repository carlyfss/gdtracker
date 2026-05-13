import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import './App.css'
import { GameDashboardLayout } from './components/GameDashboardLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import { ConfigurationPage } from './pages/ConfigurationPage'
import { DashboardPage } from './pages/DashboardPage'
import { GameCreatePage } from './pages/GameCreatePage'
import { GamesHubPage } from './pages/GamesHubPage'
import { HeatmapPage } from './pages/HeatmapPage'
import { ArchivePage } from './pages/ArchivePage'
import { FeedbackPage } from './pages/FeedbackPage'
import { IntegrationPage } from './pages/IntegrationPage'
import { LoginPage } from './pages/LoginPage'
import { PlanningPage } from './pages/planning/PlanningPage'
import { SdkIntegrationPage } from './pages/SdkIntegrationPage'
import { TasksPage } from './pages/TasksPage'

function ConfigurationRedirectFromLegacyFeatures() {
    const { gameId } = useParams<{ gameId: string }>()
    if (!gameId) {
        return <Navigate to="/games" replace />
    }
    return <Navigate to={`/g/${encodeURIComponent(gameId)}/configuration`} replace />
}

function IndexRedirect() {
    const { user, loading } = useAuth()
    if (loading) {
        return (
            <div className="fullScreenGate">
                <p className="fullScreenGateText">Loading…</p>
            </div>
        )
    }
    if (!user) {
        return <Navigate to="/login" replace />
    }
    return <Navigate to="/games" replace />
}

function App() {
    return (
        <Routes>
            <Route path="/" element={<IndexRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
                path="/games"
                element={
                    <ProtectedRoute>
                        <GamesHubPage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/games/new"
                element={
                    <ProtectedRoute>
                        <GameCreatePage />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/g/:gameId"
                element={
                    <ProtectedRoute>
                        <GameDashboardLayout />
                    </ProtectedRoute>
                }
            >
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="exceptions" element={<Navigate to="dashboard" replace />} />
                <Route path="heatmap" element={<HeatmapPage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="archive" element={<ArchivePage />} />
                <Route path="feedback" element={<FeedbackPage />} />
                <Route path="integration" element={<IntegrationPage />} />
                <Route path="sdk" element={<SdkIntegrationPage />} />
                <Route path="configuration" element={<ConfigurationPage />} />
                <Route path="planning" element={<PlanningPage />} />
                <Route path="features" element={<ConfigurationRedirectFromLegacyFeatures />} />
                <Route index element={<Navigate to="dashboard" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

export default App
