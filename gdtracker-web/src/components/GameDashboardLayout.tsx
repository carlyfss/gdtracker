import { useMemo } from 'react'
import { Link, Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import archiveNavIcon from '../assets/icons/archive_page.svg'
import configurationNavIcon from '../assets/icons/configuration_page.svg'
import feedbackNavIcon from '../assets/icons/feedback_page.svg'
import integrationNavIcon from '../assets/icons/integration_page.svg'
import planningNavIcon from '../assets/icons/planning_page.svg'
import sdkNavIcon from '../assets/icons/sdk_page.svg'
import { GameExceptionsSyncProvider } from '../context/GameExceptionsSyncContext'
import { GameIdProvider } from '../context/GameIdContext'
import { GameThemeProvider } from '../context/GameThemeContext'
import { AppAuthenticatedShell } from './AppAuthenticatedShell'

type DashboardTab =
    | 'dashboard'
    | 'heatmap'
    | 'tasks'
    | 'planning'
    | 'archive'
    | 'feedback'
    | 'integration'
    | 'sdk'
    | 'configuration'

function SidebarIcon({ children }: { children: React.ReactNode }) {
    return (
        <span className="appSidebarIcon" aria-hidden>
            {children}
        </span>
    )
}

export function GameDashboardLayout() {
    const { gameId } = useParams()
    const location = useLocation()

    const safeGameId = gameId ?? ''
    const base = safeGameId ? `/g/${encodeURIComponent(safeGameId)}` : ''

    const navItems = useMemo(
        () =>
            safeGameId
                ? ([
                      { to: `${base}/dashboard` as const, key: 'dashboard' as const, label: 'Dashboard' },
                      { to: `${base}/heatmap` as const, key: 'heatmap' as const, label: 'Heatmap' },
                      { to: `${base}/tasks` as const, key: 'tasks' as const, label: 'Tasks' },
                      { to: `${base}/planning` as const, key: 'planning' as const, label: 'Planning' },
                  ] as const)
                : [],
        [base, safeGameId]
    )

    const active: DashboardTab = useMemo(() => {
        const path = location.pathname
        if (path.endsWith('/heatmap')) return 'heatmap'
        if (path.endsWith('/tasks')) return 'tasks'
        if (path.endsWith('/planning')) return 'planning'
        if (path.endsWith('/archive')) return 'archive'
        if (path.endsWith('/feedback')) return 'feedback'
        if (path.endsWith('/integration')) return 'integration'
        if (path.endsWith('/sdk')) return 'sdk'
        if (path.endsWith('/configuration')) return 'configuration'
        return 'dashboard'
    }, [location.pathname])

    if (!gameId) {
        return <Navigate to="/games" replace />
    }

    const sidebarNav = (
        <>
            {navItems.map((item) => (
                <Link
                    key={item.key}
                    className="appSidebarLink"
                    data-active={active === item.key}
                    aria-current={active === item.key ? 'page' : undefined}
                    aria-label={item.label}
                    title={item.label}
                    to={item.to}
                >
                    <SidebarIcon>
                        {item.key === 'dashboard' && (
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <rect x="3" y="3" width="8" height="8" rx="1" />
                                <rect x="13" y="3" width="8" height="5" rx="1" />
                                <rect x="13" y="10" width="8" height="11" rx="1" />
                                <rect x="3" y="13" width="8" height="8" rx="1" />
                            </svg>
                        )}
                        {item.key === 'heatmap' && (
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z" />
                                <path d="M9 4v14" />
                                <path d="M15 6v14" />
                            </svg>
                        )}
                        {item.key === 'tasks' && (
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M9 6h11" />
                                <path d="M9 12h11" />
                                <path d="M9 18h11" />
                                <path d="M4 6l1 1 2-2" />
                                <path d="M4 12l1 1 2-2" />
                                <path d="M4 18l1 1 2-2" />
                            </svg>
                        )}
                        {item.key === 'planning' && (
                            <img src={planningNavIcon} alt="" width={20} height={20} className="appSidebarRasterIcon" />
                        )}
                    </SidebarIcon>
                    <span className="appSidebarTooltip" role="tooltip">
                        {item.label}
                    </span>
                </Link>
            ))}
            <Link
                className="appSidebarLink"
                to={`${base}/archive`}
                data-active={active === 'archive'}
                aria-label="Archive"
                aria-current={active === 'archive' ? 'page' : undefined}
                title="Archive"
            >
                <SidebarIcon>
                    <img src={archiveNavIcon} alt="" width={20} height={20} className="appSidebarRasterIcon" />
                </SidebarIcon>
                <span className="appSidebarTooltip" role="tooltip">
                    Archive
                </span>
            </Link>
            <Link
                className="appSidebarLink"
                to={`${base}/feedback`}
                data-active={active === 'feedback'}
                aria-label="Feedback"
                aria-current={active === 'feedback' ? 'page' : undefined}
                title="Feedback"
            >
                <SidebarIcon>
                    <img src={feedbackNavIcon} alt="" width={20} height={20} className="appSidebarRasterIcon" />
                </SidebarIcon>
                <span className="appSidebarTooltip" role="tooltip">
                    Feedback
                </span>
            </Link>
            <Link
                className="appSidebarLink"
                to={`${base}/integration`}
                data-active={active === 'integration'}
                aria-label="Integration"
                aria-current={active === 'integration' ? 'page' : undefined}
                title="Integration"
            >
                <SidebarIcon>
                    <img src={integrationNavIcon} alt="" width={20} height={20} className="appSidebarRasterIcon" />
                </SidebarIcon>
                <span className="appSidebarTooltip" role="tooltip">
                    Integration
                </span>
            </Link>
            <Link
                className="appSidebarLink"
                to={`${base}/sdk`}
                data-active={active === 'sdk'}
                aria-label="SDK Integration"
                aria-current={active === 'sdk' ? 'page' : undefined}
                title="SDK Integration"
            >
                <SidebarIcon>
                    <img src={sdkNavIcon} alt="" width={20} height={20} className="appSidebarRasterIcon" />
                </SidebarIcon>
                <span className="appSidebarTooltip" role="tooltip">
                    SDK Integration
                </span>
            </Link>
            <Link
                className="appSidebarLink"
                to={`${base}/configuration`}
                data-active={active === 'configuration'}
                aria-label="Configuration"
                aria-current={active === 'configuration' ? 'page' : undefined}
                title="Configuration"
            >
                <SidebarIcon>
                    <img src={configurationNavIcon} alt="" width={20} height={20} className="appSidebarRasterIcon" />
                </SidebarIcon>
                <span className="appSidebarTooltip" role="tooltip">
                    Configuration
                </span>
            </Link>
        </>
    )

    const pollExceptions = active === 'dashboard'

    return (
        <GameIdProvider gameId={gameId}>
            <GameThemeProvider>
                <GameExceptionsSyncProvider gameId={gameId} pollEnabled={pollExceptions}>
                    <AppAuthenticatedShell sidebarNav={sidebarNav} mainAriaLabel={active}>
                        <div className="appMainInner dashboardPageEnter">
                            <Outlet key={gameId} />
                        </div>
                    </AppAuthenticatedShell>
                </GameExceptionsSyncProvider>
            </GameThemeProvider>
        </GameIdProvider>
    )
}
