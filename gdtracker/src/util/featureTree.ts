import type { Feature } from '../api/features'

/** DFS order: roots first (by name), then each subtree sorted by name */
export function orderedFeatureTree(features: Feature[]): Feature[] {
    const byParent = new Map<string | null, Feature[]>()
    for (const f of features) {
        const pk = f.parentId ?? null
        let arr = byParent.get(pk)
        if (!arr) {
            arr = []
            byParent.set(pk, arr)
        }
        arr.push(f)
    }
    for (const arr of byParent.values()) {
        arr.sort((a, b) => a.name.localeCompare(b.name))
    }
    const out: Feature[] = []
    const roots = byParent.get(null) ?? []
    const walk = (node: Feature, depth: number) => {
        out.push(node)
        const kids = byParent.get(node.id) ?? []
        for (const k of kids) walk(k, depth + 1)
    }
    for (const r of roots) walk(r, 0)

    const visited = new Set(out.map((f) => f.id))
    const stranded = features.filter((f) => !visited.has(f.id)).sort((a, b) => a.name.localeCompare(b.name))
    out.push(...stranded)

    return out
}

export function descendantFeatureIds(rootId: string, features: Feature[]): Set<string> {
    const childrenByParent = new Map<string, string[]>()
    for (const f of features) {
        if (!f.parentId) continue
        let ch = childrenByParent.get(f.parentId)
        if (!ch) {
            ch = []
            childrenByParent.set(f.parentId, ch)
        }
        ch.push(f.id)
    }
    const out = new Set<string>()
    const stack = [...(childrenByParent.get(rootId) ?? [])]
    while (stack.length) {
        const id = stack.pop()!
        out.add(id)
        const next = childrenByParent.get(id)
        if (next) stack.push(...next)
    }
    return out
}

export function depthForFeature(featureId: string, features: Feature[]): number {
    const byId = new Map(features.map((f) => [f.id, f]))
    let d = 0
    let cur = byId.get(featureId)
    const seen = new Set<string>()
    while (cur?.parentId && !seen.has(cur.id)) {
        seen.add(cur.id)
        d += 1
        cur = byId.get(cur.parentId)
    }
    return d
}

export type FeatureTreeRow = {
    feature: Feature
    depth: number
    hasChildren: boolean
}

function childrenByParentSorted(features: Feature[]): Map<string | null, Feature[]> {
    const byParent = new Map<string | null, Feature[]>()
    for (const f of features) {
        const pk = f.parentId ?? null
        let arr = byParent.get(pk)
        if (!arr) {
            arr = []
            byParent.set(pk, arr)
        }
        arr.push(f)
    }
    for (const arr of byParent.values()) {
        arr.sort((a, b) => a.name.localeCompare(b.name))
    }
    return byParent
}

/**
 * Flatten features for dashboard/task-style lists: optional global hide of subfeatures,
 * and per-parent collapse when subfeatures are shown (matches task tree UX).
 */
export function flattenFeaturesForList(
    features: Feature[],
    options: { showSubfeatures: boolean; collapsedParentIds: ReadonlySet<string> }
): FeatureTreeRow[] {
    const byParent = childrenByParentSorted(features)
    const hasChildren = (id: string) => (byParent.get(id)?.length ?? 0) > 0

    if (!options.showSubfeatures) {
        const roots = byParent.get(null) ?? []
        return roots.map((f) => ({
            feature: f,
            depth: 0,
            hasChildren: hasChildren(f.id),
        }))
    }

    const roots = byParent.get(null) ?? []

    // All nodes reachable from real roots (full tree). Used only to detect broken hierarchies —
    // must not treat "skipped because parent is collapsed" as stranded, or children reappear at the end.
    const reachableFromRoots = new Set<string>()
    const markReachable = (node: Feature) => {
        reachableFromRoots.add(node.id)
        for (const k of byParent.get(node.id) ?? []) markReachable(k)
    }
    for (const r of roots) markReachable(r)

    const out: FeatureTreeRow[] = []

    const walk = (node: Feature, depth: number) => {
        out.push({
            feature: node,
            depth,
            hasChildren: hasChildren(node.id),
        })
        if (hasChildren(node.id) && !options.collapsedParentIds.has(node.id)) {
            const kids = byParent.get(node.id) ?? []
            for (const k of kids) walk(k, depth + 1)
        }
    }

    for (const r of roots) walk(r, 0)

    const stranded = features.filter((f) => !reachableFromRoots.has(f.id)).sort((a, b) => a.name.localeCompare(b.name))
    for (const f of stranded) {
        out.push({
            feature: f,
            depth: depthForFeature(f.id, features),
            hasChildren: hasChildren(f.id),
        })
    }

    return out
}
