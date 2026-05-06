import type { Task, TaskStatus } from '../api/tasks'

export type TaskListRow = {
    task: Task
    depth: number
    hasChildren: boolean
}

function taskCreatedMs(t: Task): number {
    if (t.createdAt && typeof t.createdAt === 'string') {
        const n = Date.parse(t.createdAt)
        if (!Number.isNaN(n)) return n
    }
    return 0
}

function compareTasksTreeOrder(a: Task, b: Task): number {
    const tb = taskCreatedMs(b) - taskCreatedMs(a)
    if (tb !== 0) return tb
    return (a.title ?? '').localeCompare(b.title ?? '')
}

/** Groups tasks by `parentTaskId` (null for roots). */
export function tasksChildrenByParentId(tasks: Task[]): Map<string | null, Task[]> {
    const m = new Map<string | null, Task[]>()
    for (const t of tasks) {
        const raw = t.parentTaskId
        const k = raw != null && String(raw).length > 0 ? String(raw) : null
        let arr = m.get(k)
        if (!arr) {
            arr = []
            m.set(k, arr)
        }
        arr.push(t)
    }
    for (const arr of m.values()) {
        arr.sort(compareTasksTreeOrder)
    }
    return m
}

/** Direct children only; `done` counts `status === 'DONE'` (matches feature rollups). */
export function directChildProgress(parentId: string, tasks: Task[]): { done: number; total: number } {
    const children = tasks.filter((t) => String(t.parentTaskId ?? '') === parentId)
    const total = children.length
    const done = children.filter((t) => (t.status as TaskStatus) === 'DONE').length
    return { done, total }
}

export function formatChildProgressLabel(done: number, total: number): { pct: string; ratio: string } {
    if (total <= 0) return { pct: '', ratio: '' }
    const pctN = Math.round((done / total) * 100)
    return { pct: `${pctN}%`, ratio: `${done}/${total}` }
}

/**
 * Flatten tasks in tree order for the list UI. When `showSubtasks` is false, only root tasks are returned.
 * When `showSubtasks` is true, `collapsedParentIds` omits direct children (and deeper descendants) for those parents.
 */
export function flattenTasksForList(
    tasks: Task[],
    options: { showSubtasks: boolean; collapsedParentIds: ReadonlySet<string> }
): TaskListRow[] {
    const byParent = tasksChildrenByParentId(tasks)
    const out: TaskListRow[] = []

    const hasChildren = (id: string) => (byParent.get(id)?.length ?? 0) > 0

    const walk = (node: Task, depth: number) => {
        const hc = hasChildren(node.id)
        out.push({ task: node, depth, hasChildren: hc })
        if (!options.showSubtasks) return
        if (hc && !options.collapsedParentIds.has(node.id)) {
            const kids = byParent.get(node.id) ?? []
            for (const k of kids) walk(k, depth + 1)
        }
    }

    const roots = byParent.get(null) ?? []
    for (const r of roots) walk(r, 0)

    return out
}

/** True if `descendantId` is `ancestorId` or appears under it in the task tree. */
export function isUnderAncestor(ancestorId: string, descendantId: string, tasks: Task[]): boolean {
    if (ancestorId === descendantId) return true
    const byId = new Map(tasks.map((t) => [t.id, t]))
    let cur: Task | undefined = byId.get(descendantId)
    const seen = new Set<string>()
    while (cur?.parentTaskId) {
        const p = String(cur.parentTaskId)
        if (p === ancestorId) return true
        if (seen.has(p)) break
        seen.add(p)
        cur = byId.get(p)
    }
    return false
}
