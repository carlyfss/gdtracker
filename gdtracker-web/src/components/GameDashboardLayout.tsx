import { useMemo } from 'react'
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { GameExceptionsSyncProvider } from '../context/GameExceptionsSyncContext'
import { GameIdProvider } from '../context/GameIdContext'
import { GameThemeProvider } from '../context/GameThemeContext'
import { useGameDisplayName } from '../hooks/useGameDisplayName'
import { buildGameNavItems, resolveDashboardTab, type DashboardTab } from '../nav/gameNav'
import { GameNavLinks } from '../nav/gameNavConfig'
import { breadcrumbsForPath } from '../util/appBreadcrumbs'
import { AppAuthenticatedShell } from './AppAuthenticatedShell'

export function GameDashboardLayout() {
    const { gameId } = useParams()
    const location = useLocation()

    const safeGameId = gameId ?? ''
    const base = safeGameId ? `/g/${encodeURIComponent(safeGameId)}` : ''
    const gameName = useGameDisplayName(safeGameId || undefined)

    const navItems = useMemo(() => (safeGameId ? buildGameNavItems(base) : []), [base, safeGameId])

    const active: DashboardTab = useMemo(() => resolveDashboardTab(location.pathname), [location.pathname])

    const breadcrumbs = useMemo(
        () => breadcrumbsForPath(location.pathname, safeGameId || undefined, gameName),
        [location.pathname, safeGameId, gameName]
    )

    if (!gameId) {
        return <Navigate to="/games" replace />
    }

    const sidebarNav = <GameNavLinks items={navItems} active={active} variant="sidebar" />
    const drawerNav = <GameNavLinks items={navItems} active={active} variant="drawer" />

    const pollExceptions = active === 'dashboard'

    return (
        <GameIdProvider gameId={gameId}>
            <GameThemeProvider>
                <GameExceptionsSyncProvider gameId={gameId} pollEnabled={pollExceptions}>
                    <AppAuthenticatedShell
                        sidebarNav={sidebarNav}
                        mobileDrawerNav={drawerNav}
                        breadcrumbs={breadcrumbs}
                        mainAriaLabel={active}
                    >
                        <div className="appMainInner dashboardPageEnter">
                            <Outlet key={gameId} />
                        </div>
                    </AppAuthenticatedShell>
                </GameExceptionsSyncProvider>
            </GameThemeProvider>
        </GameIdProvider>
    )
}
