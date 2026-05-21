import { listGames } from '../api/games'

const STORAGE_PREFIX = 'gdtracker:gameName:'

let loadPromise: Promise<void> | null = null

function readCached(gameId: string): string | undefined {
    try {
        return sessionStorage.getItem(`${STORAGE_PREFIX}${gameId}`) ?? undefined
    } catch {
        return undefined
    }
}

function writeCached(gameId: string, name: string): void {
    try {
        sessionStorage.setItem(`${STORAGE_PREFIX}${gameId}`, name)
    } catch {
        /* ignore quota */
    }
}

export function getCachedGameName(gameId: string): string | undefined {
    return readCached(gameId)
}

export function setCachedGameName(gameId: string, name: string): void {
    writeCached(gameId, name.trim())
}

/** Load all game names once per session; safe to call repeatedly. */
export function ensureGameNamesLoaded(): Promise<void> {
    if (loadPromise) return loadPromise
    loadPromise = (async () => {
        try {
            const games = await listGames()
            for (const g of games) {
                writeCached(g.id, g.name)
            }
        } catch {
            /* breadcrumbs fall back to id */
        }
    })()
    return loadPromise
}
