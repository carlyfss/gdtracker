export type DashboardTab =
    | 'dashboard'
    | 'heatmap'
    | 'tasks'
    | 'planning'
    | 'archive'
    | 'feedback'
    | 'integration'
    | 'sdk'
    | 'configuration'

export type GameNavItem = {
    key: DashboardTab
    label: string
    to: string
}

export function resolveDashboardTab(pathname: string): DashboardTab {
    if (pathname.endsWith('/heatmap')) return 'heatmap'
    if (pathname.endsWith('/tasks')) return 'tasks'
    if (pathname.endsWith('/planning')) return 'planning'
    if (pathname.endsWith('/archive')) return 'archive'
    if (pathname.endsWith('/feedback')) return 'feedback'
    if (pathname.endsWith('/integration')) return 'integration'
    if (pathname.endsWith('/sdk')) return 'sdk'
    if (pathname.endsWith('/configuration')) return 'configuration'
    return 'dashboard'
}

export function buildGameNavItems(base: string): GameNavItem[] {
    return [
        { key: 'dashboard', label: 'Dashboard', to: `${base}/dashboard` },
        { key: 'heatmap', label: 'Heatmap', to: `${base}/heatmap` },
        { key: 'tasks', label: 'Tasks', to: `${base}/tasks` },
        { key: 'planning', label: 'Planning', to: `${base}/planning` },
        { key: 'archive', label: 'Archive', to: `${base}/archive` },
        { key: 'feedback', label: 'Feedback', to: `${base}/feedback` },
        { key: 'integration', label: 'Integration', to: `${base}/integration` },
        { key: 'sdk', label: 'SDK Integration', to: `${base}/sdk` },
        { key: 'configuration', label: 'Configuration', to: `${base}/configuration` },
    ]
}
