import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { AppBreadcrumb } from '../util/appBreadcrumbs'

type Props = {
    breadcrumbs: AppBreadcrumb[]
    onOpenMenu: () => void
    menuOpen: boolean
    actions?: ReactNode
}

export function AppMobileHeader({ breadcrumbs, onOpenMenu, menuOpen, actions }: Props) {
    return (
        <header className="appMobileHeader" aria-label="Page header">
            <div className="appMobileHeaderInner">
                <button
                    type="button"
                    className="appMobileMenuButton"
                    aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                    aria-expanded={menuOpen}
                    aria-controls="app-nav-drawer"
                    onClick={onOpenMenu}
                >
                    <span className="appMobileMenuIcon" aria-hidden />
                </button>
                <nav className="appBreadcrumbs" aria-label="Breadcrumb">
                    <ol className="appBreadcrumbsList">
                        {breadcrumbs.map((crumb, i) => {
                            const isLast = i === breadcrumbs.length - 1
                            return (
                                <li key={`${crumb.label}-${i}`} className="appBreadcrumbsItem">
                                    {i > 0 ? (
                                        <span className="appBreadcrumbsSep" aria-hidden>
                                            ›
                                        </span>
                                    ) : null}
                                    {crumb.to && !isLast ? (
                                        <Link className="appBreadcrumbsLink" to={crumb.to}>
                                            {crumb.label}
                                        </Link>
                                    ) : (
                                        <span
                                            className="appBreadcrumbsCurrent"
                                            aria-current={isLast ? 'page' : undefined}
                                        >
                                            {crumb.label}
                                        </span>
                                    )}
                                </li>
                            )
                        })}
                    </ol>
                </nav>
                {actions ? <div className="appMobileHeaderActions">{actions}</div> : null}
            </div>
        </header>
    )
}
