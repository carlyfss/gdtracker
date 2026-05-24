import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PlanningNodeMeta } from '../api/planning.ts'
import {
    buildTree,
    canMovePlanningNode,
    comparePlanningNodes,
    computeMoveUpdates,
    getAncestors,
    getChildren,
    isDescendant,
    resolveDropTarget,
} from './planningTree.ts'

function node(id: string, opts: Partial<PlanningNodeMeta> & Pick<PlanningNodeMeta, 'kind' | 'name'>): PlanningNodeMeta {
    return {
        id,
        parentId: opts.parentId ?? null,
        kind: opts.kind,
        name: opts.name,
        sortOrder: opts.sortOrder ?? 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    }
}

describe('comparePlanningNodes', () => {
    it('sorts by sortOrder then name', () => {
        const a = node('a', { kind: 'markdown', name: 'Beta', sortOrder: 1 })
        const b = node('b', { kind: 'markdown', name: 'Alpha', sortOrder: 0 })
        assert.ok(comparePlanningNodes(b, a) < 0)
        assert.ok(comparePlanningNodes(a, b) > 0)
    })
})

describe('buildTree', () => {
    it('orders siblings by sortOrder', () => {
        const nodes = [
            node('f1', { kind: 'folder', name: 'Folder', sortOrder: 0 }),
            node('d2', { kind: 'markdown', name: 'Second', parentId: 'f1', sortOrder: 1 }),
            node('d1', { kind: 'markdown', name: 'First', parentId: 'f1', sortOrder: 0 }),
        ]
        const tree = buildTree(nodes)
        assert.equal(tree.length, 1)
        assert.deepEqual(
            tree[0]!.children.map((c) => c.node.id),
            ['d1', 'd2']
        )
    })
})

describe('getChildren', () => {
    it('returns root children when parentId is null', () => {
        const nodes = [
            node('a', { kind: 'markdown', name: 'A', sortOrder: 0 }),
            node('b', { kind: 'markdown', name: 'B', parentId: 'x', sortOrder: 0 }),
        ]
        assert.deepEqual(
            getChildren(nodes, null).map((n) => n.id),
            ['a']
        )
    })
})

describe('isDescendant', () => {
    it('detects nested descendants', () => {
        const nodes = [
            node('f', { kind: 'folder', name: 'F', sortOrder: 0 }),
            node('c', { kind: 'folder', name: 'C', parentId: 'f', sortOrder: 0 }),
            node('d', { kind: 'markdown', name: 'D', parentId: 'c', sortOrder: 0 }),
        ]
        assert.equal(isDescendant(nodes, 'f', 'd'), true)
        assert.equal(isDescendant(nodes, 'f', 'c'), true)
        assert.equal(isDescendant(nodes, 'c', 'f'), false)
    })
})

describe('getAncestors', () => {
    it('returns parents from root to immediate parent', () => {
        const nodes = [
            node('f', { kind: 'folder', name: 'F', sortOrder: 0 }),
            node('c', { kind: 'folder', name: 'C', parentId: 'f', sortOrder: 0 }),
            node('d', { kind: 'markdown', name: 'D', parentId: 'c', sortOrder: 0 }),
        ]
        assert.deepEqual(
            getAncestors(nodes, 'd').map((n) => n.id),
            ['f', 'c']
        )
    })
})

describe('canMovePlanningNode', () => {
    it('blocks moving into self or descendants', () => {
        const nodes = [
            node('f', { kind: 'folder', name: 'F', sortOrder: 0 }),
            node('c', { kind: 'folder', name: 'C', parentId: 'f', sortOrder: 0 }),
        ]
        assert.equal(canMovePlanningNode(nodes, 'f', 'f'), false)
        assert.equal(canMovePlanningNode(nodes, 'f', 'c'), false)
        assert.equal(canMovePlanningNode(nodes, 'c', 'f'), true)
    })
})

describe('computeMoveUpdates', () => {
    it('renumbers siblings when reordering within the same parent', () => {
        const nodes = [
            node('a', { kind: 'markdown', name: 'A', sortOrder: 0 }),
            node('b', { kind: 'markdown', name: 'B', sortOrder: 1 }),
            node('c', { kind: 'markdown', name: 'C', sortOrder: 2 }),
        ]
        const updates = computeMoveUpdates(nodes, 'c', null, 0)
        assert.deepEqual(
            updates.map((u) => ({ id: u.id, sortOrder: u.sortOrder })),
            [
                { id: 'c', sortOrder: 0 },
                { id: 'a', sortOrder: 1 },
                { id: 'b', sortOrder: 2 },
            ]
        )
    })

    it('updates both old and new sibling groups when changing parent', () => {
        const nodes = [
            node('f', { kind: 'folder', name: 'F', sortOrder: 0 }),
            node('a', { kind: 'markdown', name: 'A', sortOrder: 0 }),
            node('b', { kind: 'markdown', name: 'B', parentId: 'f', sortOrder: 0 }),
        ]
        const updates = computeMoveUpdates(nodes, 'a', 'f', 1)
        const byId = new Map(updates.map((u) => [u.id, u]))
        assert.equal(byId.get('a')?.parentId, 'f')
        assert.equal(byId.get('a')?.sortOrder, 1)
        assert.equal(
            updates.some((u) => u.id === 'b'),
            false
        )
    })
})

describe('resolveDropTarget', () => {
    it('resolves folder-into drops at end of folder', () => {
        const nodes = [
            node('f', { kind: 'folder', name: 'F', sortOrder: 0 }),
            node('a', { kind: 'markdown', name: 'A', sortOrder: 1 }),
            node('b', { kind: 'markdown', name: 'B', parentId: 'f', sortOrder: 0 }),
        ]
        const target = resolveDropTarget(nodes, 'a', 'into:f', 'folder-into', false)
        assert.deepEqual(target, { parentId: 'f', index: 1 })
    })
})
