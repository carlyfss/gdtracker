import { useMemo } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import godotLogo from '../assets/godot_white.svg'
import { GameIdProvider } from '../context/GameIdContext'
import { GameThemeProvider } from '../context/GameThemeContext'
import { useAuth } from '../context/AuthContext'

type DashboardTab = 'dashboard' | 'heatmap' | 'tasks' | 'configuration'

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
    const navigate = useNavigate()
    const { logout } = useAuth()

    const safeGameId = gameId ?? ''
    const base = safeGameId ? `/g/${encodeURIComponent(safeGameId)}` : ''

    const navItems = useMemo(
        () =>
            safeGameId
                ? ([
                      { to: `${base}/dashboard` as const, key: 'dashboard' as const, label: 'Dashboard' },
                      { to: `${base}/heatmap` as const, key: 'heatmap' as const, label: 'Heatmap' },
                      { to: `${base}/tasks` as const, key: 'tasks' as const, label: 'Tasks' },
                  ] as const)
                : [],
        [base, safeGameId]
    )

    const active: DashboardTab = useMemo(() => {
        const path = location.pathname
        if (path.endsWith('/heatmap')) return 'heatmap'
        if (path.endsWith('/tasks')) return 'tasks'
        if (path.endsWith('/configuration')) return 'configuration'
        return 'dashboard'
    }, [location.pathname])

    if (!gameId) {
        return <Navigate to="/games" replace />
    }

    return (
        <GameIdProvider gameId={gameId}>
            <GameThemeProvider>
                <div className="appShell">
                    <header className="appHeader">
                        <div className="appHeaderInner">
                            <div className="appBrand">
                                <div className="appBrandLockup">
                                    <div className="appBrandLogoWrap">
                                        <img src={godotLogo} alt="" className="appBrandLogo" />
                                    </div>
                                    <h1 className="appTitle">GDTracker</h1>
                                    <div className="appSubtitle">Dashboard, trace hot spots, and task tracking</div>
                                </div>
                            </div>
                            <div className="appHeaderActions">
                                <Link className="appTextLink" to="/games">
                                    Games
                                </Link>
                                <button
                                    type="button"
                                    className="appLogoutButton"
                                    onClick={() => {
                                        void (async () => {
                                            await logout()
                                            navigate('/login', { replace: true })
                                        })()
                                    }}
                                >
                                    Log out
                                </button>
                            </div>
                        </div>
                    </header>

                    <div className="appBody">
                        <aside className="appSidebar" aria-label="Game navigation">
                            <nav className="appSidebarNav" aria-label="Game sections">
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
                                        </SidebarIcon>
                                        <span className="appSidebarTooltip" role="tooltip">
                                            {item.label}
                                        </span>
                                    </Link>
                                ))}
                                <Link
                                    className="appSidebarLink"
                                    to={`${base}/configuration`}
                                    data-active={active === 'configuration'}
                                    aria-label="Configuration"
                                    aria-current={active === 'configuration' ? 'page' : undefined}
                                    title="Configuration"
                                >
                                    <SidebarIcon>
                                        <svg
                                            width="20"
                                            height="20"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                        >
                                            <circle cx="12" cy="12" r="3" />
                                            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                                        </svg>
                                    </SidebarIcon>
                                    <span className="appSidebarTooltip" role="tooltip">
                                        Configuration
                                    </span>
                                </Link>
                            </nav>
                        </aside>

                        <main className="appMain" aria-label={active}>
                            <div className="appMainInner dashboardPageEnter">
                                <Outlet key={gameId} />
                            </div>
                        </main>
                    </div>
                </div>
            </GameThemeProvider>
        </GameIdProvider>
    )
}
