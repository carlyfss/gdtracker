export type AppBreadcrumb = {
    label: string
    to?: string
}

const GAME_SECTION_LABELS: Record<string, string> = {
    dashboard: 'Dashboard',
    heatmap: 'Heatmap',
    tasks: 'Tasks',
    planning: 'Planning',
    archive: 'Archive',
    feedback: 'Feedback',
    integration: 'Integration',
    sdk: 'SDK Integration',
    configuration: 'Configuration',
}

function gameSectionFromPath(pathname: string): string | null {
    const m = pathname.match(/\/g\/[^/]+\/([^/]+)/)
    return m?.[1] ?? null
}

export function breadcrumbsForPath(pathname: string, gameId?: string, gameName?: string): AppBreadcrumb[] {
    const crumbs: AppBreadcrumb[] = [{ label: 'Games', to: '/games' }]

    if (!gameId) {
        if (pathname === '/games/new') {
            crumbs.push({ label: 'New game' })
        }
        return crumbs
    }

    const displayName = gameName?.trim() || gameId
    crumbs.push({
        label: displayName,
        to: `/g/${encodeURIComponent(gameId)}/dashboard`,
    })

    const sectionKey = gameSectionFromPath(pathname)
    if (sectionKey && sectionKey !== 'dashboard') {
        const label = GAME_SECTION_LABELS[sectionKey] ?? sectionKey
        crumbs.push({ label })
    }

    return crumbs
}
