import type { TaskStatus } from '../api/tasks'

export const allStatus: TaskStatus[] = ['PENDING', 'TODO', 'IN_PROGRESS', 'COMPLETED', 'DONE']

export function statusLabel(s: TaskStatus): string {
    switch (s) {
        case 'PENDING':
            return 'Pending'
        case 'TODO':
            return 'Todo'
        case 'IN_PROGRESS':
            return 'In Progress'
        case 'COMPLETED':
            return 'Completed'
        case 'DONE':
            return 'Done'
        default:
            return s
    }
}

export function nextTaskStatus(s: TaskStatus): TaskStatus | null {
    const i = allStatus.indexOf(s)
    if (i < 0 || i >= allStatus.length - 1) return null
    return allStatus[i + 1]!
}
