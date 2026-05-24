import type { PlanningNodeMeta } from '../api/planning'

export type PlanningTreeEntry = {
    node: PlanningNodeMeta
    children: PlanningTreeEntry[]
}

export type PlanningNodeMoveUpdate = {
    id: string
    parentId: string | null
    sortOrder: number
}

export function comparePlanningNodes(a: PlanningNodeMeta, b: PlanningNodeMeta): number {
    if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

export function getChildren(nodes: PlanningNodeMeta[], parentId: string | null): PlanningNodeMeta[] {
    return nodes.filter((n) => n.parentId === parentId).sort(comparePlanningNodes)
}

export function buildTree(nodes: PlanningNodeMeta[], rootParentId: string | null = null): PlanningTreeEntry[] {
    const walk = (parentId: string | null): PlanningTreeEntry[] => {
        return getChildren(nodes, parentId).map((node) => ({
            node,
            children: node.kind === 'folder' ? walk(node.id) : [],
        }))
    }
    return walk(rootParentId)
}

export function findPlanningNode(nodes: PlanningNodeMeta[], id: string): PlanningNodeMeta | undefined {
    return nodes.find((n) => n.id === id)
}

export function getAncestors(nodes: PlanningNodeMeta[], nodeId: string): PlanningNodeMeta[] {
    const out: PlanningNodeMeta[] = []
    let current = findPlanningNode(nodes, nodeId)
    while (current?.parentId) {
        const parent = findPlanningNode(nodes, current.parentId)
        if (!parent) {
            break
        }
        out.unshift(parent)
        current = parent
    }
    return out
}

export function isDescendant(nodes: PlanningNodeMeta[], ancestorId: string, maybeDescendantId: string): boolean {
    if (ancestorId === maybeDescendantId) {
        return true
    }
    const childIds = nodes.filter((n) => n.parentId === ancestorId).map((n) => n.id)
    for (const childId of childIds) {
        if (isDescendant(nodes, childId, maybeDescendantId)) {
            return true
        }
    }
    return false
}

export function canMovePlanningNode(nodes: PlanningNodeMeta[], nodeId: string, targetParentId: string | null): boolean {
    if (targetParentId === nodeId) {
        return false
    }
    if (targetParentId != null && isDescendant(nodes, nodeId, targetParentId)) {
        return false
    }
    if (targetParentId != null) {
        const parent = findPlanningNode(nodes, targetParentId)
        if (!parent || parent.kind !== 'folder') {
            return false
        }
    }
    return true
}

/** Returns PUT payloads for nodes whose parentId or sortOrder changed after a move/reorder. */
export function computeMoveUpdates(
    nodes: PlanningNodeMeta[],
    draggedId: string,
    targetParentId: string | null,
    targetIndex: number
): PlanningNodeMoveUpdate[] {
    const dragged = findPlanningNode(nodes, draggedId)
    if (!dragged) {
        return []
    }
    if (!canMovePlanningNode(nodes, draggedId, targetParentId)) {
        return []
    }

    const clampedIndex = Math.max(0, targetIndex)
    const oldParentId = dragged.parentId
    const oldSiblings = getChildren(nodes, oldParentId).filter((n) => n.id !== draggedId)
    const newSiblings = getChildren(nodes, targetParentId).filter((n) => n.id !== draggedId)
    const insertIndex = Math.min(clampedIndex, newSiblings.length)
    newSiblings.splice(insertIndex, 0, dragged)

    const updates: PlanningNodeMoveUpdate[] = []

    const pushSiblingUpdates = (parentId: string | null, siblings: PlanningNodeMeta[]) => {
        siblings.forEach((node, index) => {
            const nextParentId = parentId
            const nextSortOrder = index
            if (node.parentId !== nextParentId || node.sortOrder !== nextSortOrder) {
                updates.push({ id: node.id, parentId: nextParentId, sortOrder: nextSortOrder })
            }
        })
    }

    if (oldParentId !== targetParentId) {
        pushSiblingUpdates(oldParentId, oldSiblings)
    }
    pushSiblingUpdates(targetParentId, newSiblings)

    return updates
}

export function applyMoveUpdates(nodes: PlanningNodeMeta[], updates: PlanningNodeMoveUpdate[]): PlanningNodeMeta[] {
    const byId = new Map(updates.map((u) => [u.id, u]))
    return nodes.map((n) => {
        const patch = byId.get(n.id)
        if (!patch) {
            return n
        }
        return { ...n, parentId: patch.parentId, sortOrder: patch.sortOrder }
    })
}

export function resolveDropTarget(
    nodes: PlanningNodeMeta[],
    draggedId: string,
    overId: string,
    overType: 'node' | 'folder-into' | 'root-into',
    insertAfter: boolean
): { parentId: string | null; index: number } | null {
    if (overType === 'root-into') {
        const siblings = getChildren(nodes, null).filter((n) => n.id !== draggedId)
        return { parentId: null, index: siblings.length }
    }

    if (overType === 'folder-into') {
        const folderId = overId.replace(/^into:/, '')
        if (!canMovePlanningNode(nodes, draggedId, folderId)) {
            return null
        }
        const siblings = getChildren(nodes, folderId).filter((n) => n.id !== draggedId)
        return { parentId: folderId, index: siblings.length }
    }

    const overNode = findPlanningNode(nodes, overId)
    if (!overNode) {
        return null
    }

    const parentId = overNode.parentId
    if (!canMovePlanningNode(nodes, draggedId, parentId)) {
        return null
    }

    const siblings = getChildren(nodes, parentId).filter((n) => n.id !== draggedId)
    let index = siblings.findIndex((n) => n.id === overNode.id)
    if (index < 0) {
        index = siblings.length
    } else if (insertAfter) {
        index += 1
    }
    return { parentId, index }
}
