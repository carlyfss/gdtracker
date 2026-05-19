const STORAGE_PREFIX = 'gdtracker.tasks.lastFeatureId:'

function storageKey(gameId: string): string {
    return `${STORAGE_PREFIX}${gameId}`
}

/** Read persisted last feature id for a game; returns null if missing or invalid. */
export function readLastTaskFeatureId(gameId: string, validFeatureIds: readonly string[]): string | null {
    if (!gameId.trim()) return null
    try {
        const raw = localStorage.getItem(storageKey(gameId))
        if (!raw || !raw.trim()) return null
        const id = raw.trim()
        return validFeatureIds.includes(id) ? id : null
    } catch {
        return null
    }
}

/** Persist last feature id for a game; no-ops on empty id or storage errors. */
export function writeLastTaskFeatureId(gameId: string, featureId: string): void {
    const id = featureId.trim()
    if (!gameId.trim() || !id) return
    try {
        localStorage.setItem(storageKey(gameId), id)
    } catch {
        /* private browsing / quota — ignore */
    }
}
