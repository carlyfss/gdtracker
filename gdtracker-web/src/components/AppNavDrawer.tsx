import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import godotLogo from '../assets/godot_white.svg'
import gamesNavIcon from '../assets/icons/games_page.svg'
import logoutNavIcon from '../assets/icons/logout_button.svg'
import { useAuth } from '../context/AuthContext'

type Props = {
    open: boolean
    onClose: () => void
    gameNav?: ReactNode
    sidebarNavLabel?: string
}

export function AppNavDrawer({ open, onClose, gameNav, sidebarNavLabel = 'Game sections' }: Props) {
    const location = useLocation()
    const navigate = useNavigate()
    const { logout } = useAuth()
    const panelId = useId()
    const closeBtnRef = useRef<HTMLButtonElement>(null)
    const gamesHubActive = location.pathname === '/games' || location.pathname.startsWith('/games/')

    useEffect(() => {
        if (!open) return
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        closeBtnRef.current?.focus()
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKey)
        return () => {
            document.body.style.overflow = prev
            document.removeEventListener('keydown', onKey)
        }
    }, [open, onClose])

    useEffect(() => {
        onClose()
    }, [location.pathname, onClose])

    if (!open) return null

    return (
        <div className="appNavDrawerRoot" role="presentation">
            <button type="button" className="appNavDrawerBackdrop" aria-label="Close menu" onClick={onClose} />
            <aside
                id="app-nav-drawer"
                className="appNavDrawerPanel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={panelId}
            >
                <div className="appNavDrawerHeader">
                    <Link className="appNavDrawerLogoLink" to="/games" onClick={onClose} aria-label="Games hub">
                        <img src={godotLogo} alt="" className="appNavDrawerLogo" />
                    </Link>
                    <h2 id={panelId} className="appNavDrawerTitle">
                        Menu
                    </h2>
                    <button
                        ref={closeBtnRef}
                        type="button"
                        className="appNavDrawerClose"
                        aria-label="Close menu"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>
                <nav className="appNavDrawerSection" aria-label="App">
                    <Link
                        className="appNavDrawerLink appNavDrawerLink--hub"
                        to="/games"
                        data-active={gamesHubActive}
                        aria-current={gamesHubActive ? 'page' : undefined}
                        onClick={onClose}
                    >
                        <span className="appNavDrawerLinkIcon" aria-hidden>
                            <img src={gamesNavIcon} alt="" width={20} height={20} className="appSidebarRasterIcon" />
                        </span>
                        <span className="appNavDrawerLinkLabel">Games</span>
                    </Link>
                </nav>
                {gameNav ? (
                    <nav className="appNavDrawerSection" aria-label={sidebarNavLabel}>
                        {gameNav}
                    </nav>
                ) : null}
                <div className="appNavDrawerFooter">
                    <button
                        type="button"
                        className="appNavDrawerLogout"
                        onClick={() => {
                            void (async () => {
                                await logout()
                                navigate('/login', { replace: true })
                            })()
                        }}
                    >
                        <img src={logoutNavIcon} alt="" width={20} height={20} className="appSidebarRasterIcon" />
                        Log out
                    </button>
                </div>
            </aside>
        </div>
    )
}
