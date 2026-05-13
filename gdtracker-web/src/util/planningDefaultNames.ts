import type { PlanningKind, PlanningNodeMeta } from '../api/planning'

const MAX_SUFFIX = 10000

function siblingNameSet(siblings: PlanningNodeMeta[]): Set<string> {
    return new Set(siblings.map((n) => n.name.toLowerCase()))
}

function firstFreeIndexedName(baseUnindexed: string, occupied: Set<string>): string {
    let k = 0
    while (k <= MAX_SUFFIX) {
        const candidate = k === 0 ? baseUnindexed : `${baseUnindexed} (${k})`
        if (!occupied.has(candidate.toLowerCase())) {
            return candidate
        }
        k += 1
    }
    return `${baseUnindexed} (${Date.now()})`
}

/**
 * Next default document name under the same parent, filling gaps (e.g. Untitled.md before Untitled (2).md)
 * and respecting DB-style case-insensitive uniqueness among siblings.
 */
export function nextDefaultPlanningNodeName(siblings: PlanningNodeMeta[], kind: PlanningKind): string {
    const occupied = siblingNameSet(siblings)
    if (kind === 'markdown') {
        const stem = 'Untitled'
        const ext = '.md'
        const base = `${stem}${ext}`
        let k = 0
        while (k <= MAX_SUFFIX) {
            const candidate = k === 0 ? base : `${stem} (${k})${ext}`
            if (!occupied.has(candidate.toLowerCase())) {
                return candidate
            }
            k += 1
        }
        return `${stem} (${Date.now()})${ext}`
    }
    if (kind === 'folder') {
        return firstFreeIndexedName('New folder', occupied)
    }
    return firstFreeIndexedName('Untitled drawing', occupied)
}
