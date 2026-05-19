import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { flattenTasksForList } from './taskTree.ts'
import type { Task } from '../api/tasks.ts'

function task(id: string, parentTaskId?: string | null): Task {
    return {
        id,
        title: id,
        status: 'TODO',
        featureId: 'f1',
        parentTaskId: parentTaskId ?? null,
    }
}

describe('flattenTasksForList', () => {
    it('shows matching subtask when parent is not in the filtered set', () => {
        const tasks = [task('child', 'parent')]
        const rows = flattenTasksForList(tasks, { showSubtasks: true, collapsedParentIds: new Set() })
        assert.equal(rows.length, 1)
        assert.equal(rows[0]!.task.id, 'child')
        assert.equal(rows[0]!.depth, 0)
    })

    it('indents subtask when parent is present', () => {
        const tasks = [task('parent'), task('child', 'parent')]
        const rows = flattenTasksForList(tasks, { showSubtasks: true, collapsedParentIds: new Set() })
        assert.equal(rows.length, 2)
        assert.equal(rows[0]!.task.id, 'parent')
        assert.equal(rows[1]!.task.id, 'child')
        assert.equal(rows[1]!.depth, 1)
    })
})
