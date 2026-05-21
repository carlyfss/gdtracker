import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import archiveNavIcon from '../assets/icons/archive_page.svg'
import configurationNavIcon from '../assets/icons/configuration_page.svg'
import feedbackNavIcon from '../assets/icons/feedback_page.svg'
import integrationNavIcon from '../assets/icons/integration_page.svg'
import planningNavIcon from '../assets/icons/planning_page.svg'
import sdkNavIcon from '../assets/icons/sdk_page.svg'
import type { DashboardTab, GameNavItem } from './gameNav'

function SidebarIcon({ children }: { children: ReactNode }) {
    return (
        <span className="appSidebarIcon" aria-hidden>
            {children}
        </span>
    )
}

export function GameNavIcon({ navKey }: { navKey: DashboardTab }) {
    switch (navKey) {
        case 'dashboard':
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="8" height="8" rx="1" />
                    <rect x="13" y="3" width="8" height="5" rx="1" />
                    <rect x="13" y="10" width="8" height="11" rx="1" />
                    <rect x="3" y="13" width="8" height="8" rx="1" />
                </svg>
            )
        case 'heatmap':
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z" />
                    <path d="M9 4v14" />
                    <path d="M15 6v14" />
                </svg>
            )
        case 'tasks':
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 6h11" />
                    <path d="M9 12h11" />
                    <path d="M9 18h11" />
                    <path d="M4 6l1 1 2-2" />
                    <path d="M4 12l1 1 2-2" />
                    <path d="M4 18l1 1 2-2" />
                </svg>
            )
        case 'planning':
            return <img src={planningNavIcon} alt="" width={20} height={20} className="appSidebarRasterIcon" />
        case 'archive':
            return <img src={archiveNavIcon} alt="" width={20} height={20} className="appSidebarRasterIcon" />
        case 'feedback':
            return <img src={feedbackNavIcon} alt="" width={20} height={20} className="appSidebarRasterIcon" />
        case 'integration':
            return <img src={integrationNavIcon} alt="" width={20} height={20} className="appSidebarRasterIcon" />
        case 'sdk':
            return <img src={sdkNavIcon} alt="" width={20} height={20} className="appSidebarRasterIcon" />
        case 'configuration':
            return <img src={configurationNavIcon} alt="" width={20} height={20} className="appSidebarRasterIcon" />
        default:
            return null
    }
}

type NavLinksProps = {
    items: GameNavItem[]
    active: DashboardTab
    variant: 'sidebar' | 'drawer'
    onNavigate?: () => void
}

export function GameNavLinks({ items, active, variant, onNavigate }: NavLinksProps) {
    if (variant === 'sidebar') {
        return (
            <>
                {items.map((item) => (
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
                            <GameNavIcon navKey={item.key} />
                        </SidebarIcon>
                        <span className="appSidebarTooltip" role="tooltip">
                            {item.label}
                        </span>
                    </Link>
                ))}
            </>
        )
    }

    return (
        <ul className="appNavDrawerList">
            {items.map((item) => (
                <li key={item.key}>
                    <Link
                        className="appNavDrawerLink"
                        data-active={active === item.key}
                        aria-current={active === item.key ? 'page' : undefined}
                        to={item.to}
                        onClick={onNavigate}
                    >
                        <span className="appNavDrawerLinkIcon" aria-hidden>
                            <GameNavIcon navKey={item.key} />
                        </span>
                        <span className="appNavDrawerLinkLabel">{item.label}</span>
                    </Link>
                </li>
            ))}
        </ul>
    )
}
