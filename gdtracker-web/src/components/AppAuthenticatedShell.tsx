import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import godotLogo from '../assets/godot_white.svg'
import gamesNavIcon from '../assets/icons/games_page.svg'
import logoutNavIcon from '../assets/icons/logout_button.svg'
import { useAuth } from '../context/AuthContext'

type Props = {
    children: ReactNode
    /** Icon-only game nav (and similar); empty when not in a game context. */
    sidebarNav: ReactNode
    /** `aria-label` for the scrollable middle `<nav>`. */
    sidebarNavLabel?: string
    /** Optional `aria-label` on `<main>`. */
    mainAriaLabel?: string
}

export function AppAuthenticatedShell({
    children,
    sidebarNav,
    sidebarNavLabel = 'Game sections',
    mainAriaLabel,
}: Props) {
    const location = useLocation()
    const navigate = useNavigate()
    const { logout } = useAuth()

    const gamesHubActive = location.pathname === '/games' || location.pathname.startsWith('/games/')

    return (
        <div className="appShell">
            <div className="appBody">
                <aside className="appSidebar" aria-label="App navigation">
                    <div className="appSidebarTop">
                        <Link className="appSidebarLogoLink" to="/games" aria-label="Games hub home" title="Games hub">
                            <img src={godotLogo} alt="" className="appSidebarLogo" />
                        </Link>
                        <Link
                            className="appSidebarLink"
                            to="/games"
                            data-active={gamesHubActive}
                            aria-current={gamesHubActive ? 'page' : undefined}
                            aria-label="Games"
                            title="Games"
                        >
                            <span className="appSidebarIcon" aria-hidden>
                                <img
                                    src={gamesNavIcon}
                                    alt=""
                                    width={20}
                                    height={20}
                                    className="appSidebarRasterIcon"
                                />
                            </span>
                            <span className="appSidebarTooltip" role="tooltip">
                                Games
                            </span>
                        </Link>
                    </div>
                    <div className="appSidebarDivider" aria-hidden />
                    <div className="appSidebarNavScroll">
                        <nav className="appSidebarNav" aria-label={sidebarNavLabel}>
                            {sidebarNav}
                        </nav>
                    </div>
                    <div className="appSidebarDivider" aria-hidden />
                    <div className="appSidebarFooter">
                        <button
                            type="button"
                            className="appSidebarLogoutButton"
                            aria-label="Log out"
                            title="Log out"
                            onClick={() => {
                                void (async () => {
                                    await logout()
                                    navigate('/login', { replace: true })
                                })()
                            }}
                        >
                            <span className="appSidebarIcon" aria-hidden>
                                <img
                                    src={logoutNavIcon}
                                    alt=""
                                    width={20}
                                    height={20}
                                    className="appSidebarRasterIcon"
                                />
                            </span>
                            <span className="appSidebarTooltip" role="tooltip">
                                Log out
                            </span>
                        </button>
                    </div>
                </aside>
                <main className="appMain" aria-label={mainAriaLabel}>
                    {children}
                </main>
            </div>
        </div>
    )
}
