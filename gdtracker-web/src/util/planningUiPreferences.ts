const STORAGE_KEY = 'gdtracker.planning.treeOpen'

/** Read persisted document-tree visibility; defaults to visible. */
export function readPlanningTreeOpen(): boolean {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw === '0') {
            return false
        }
        if (raw === '1') {
            return true
        }
        return true
    } catch {
        return true
    }
}

/** Persist document-tree visibility; no-ops on storage errors. */
export function writePlanningTreeOpen(open: boolean): void {
    try {
        localStorage.setItem(STORAGE_KEY, open ? '1' : '0')
    } catch {
        /* private browsing / quota — ignore */
    }
}
