import type { Category } from '../../api/categories'
import type { Feature } from '../../api/features'
import type { Tag } from '../../api/tags'
import type { Task, TaskPlanningDocumentRef, TaskStatus } from '../../api/tasks'
import { taskPlanningDocumentRefsFromApi } from '../../api/tasks'
import { normalizeHex6 } from '../../util/hexColor'
import { isUnderAncestor } from '../../util/taskTree'

export type UiState =
    | { kind: 'idle' }
    | { kind: 'loading'; message: string }
    | { kind: 'error'; message: string }
    | { kind: 'success'; message: string }

export type TaskDraft = {
    title: string
    description: string
    status: TaskStatus
    featureId: string
    categoryId: string
    parentTaskId: string
    tagIds: string[]
    sourceGameExceptionId: string
    planningDocumentRefs: TaskPlanningDocumentRef[]
}

export type CreateFromExceptionState = {
    exceptionId: string
    title: string
    description: string
    categoryId?: string
}

export type TaskModal =
    | { kind: 'closed' }
    | { kind: 'create'; draft: TaskDraft }
    | { kind: 'task'; taskId: string; surface: 'view'; draft: TaskDraft }
    | { kind: 'task'; taskId: string; surface: 'edit'; draft: TaskDraft; editBaseline: TaskDraft }

export const FALLBACK_FEATURE_COLOR = '#94a3b8'

export function normalizeTitle(raw: string): string {
    return raw.trim().replace(/\s+/g, ' ')
}

export function featureMeta(t: Task, features: Feature[]) {
    const f = t.feature ?? (t.featureId ? features.find((x) => x.id === t.featureId) : undefined)
    return { name: f?.name ?? '', color: normalizeHex6(f?.color, FALLBACK_FEATURE_COLOR) }
}

export function categoryMeta(t: Task, categories: Category[]) {
    const c = t.category ?? (t.categoryId ? categories.find((x) => x.id === t.categoryId) : undefined)
    return { name: c?.name ?? '', color: normalizeHex6(c?.color, FALLBACK_FEATURE_COLOR) }
}

export function sortedTaskTags(t: Task): Tag[] {
    const raw = t.tags
    if (!Array.isArray(raw) || raw.length === 0) return []
    return [...raw].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
}

export function tagIdsFromTask(t: Task): string[] {
    const fromTags = t.tags?.map((x) => x.id).filter(Boolean)
    if (fromTags && fromTags.length > 0) return fromTags
    const raw = t.tagIds
    if (Array.isArray(raw)) {
        return raw.filter((id): id is string => typeof id === 'string' && id.length > 0)
    }
    return []
}

export function draftFromTask(t: Task): TaskDraft {
    const pid = t.parentTaskId
    const sid = t.sourceGameExceptionId
    return {
        title: t.title ?? '',
        description: typeof t.description === 'string' ? t.description : '',
        status: (t.status ?? 'TODO') as TaskStatus,
        featureId: String(t.feature?.id ?? t.featureId ?? ''),
        categoryId: String(t.category?.id ?? t.categoryId ?? ''),
        parentTaskId: typeof pid === 'string' && pid.length > 0 ? pid : '',
        tagIds: tagIdsFromTask(t),
        sourceGameExceptionId: typeof sid === 'string' && sid.length > 0 ? sid : '',
        planningDocumentRefs: taskPlanningDocumentRefsFromApi(t),
    }
}

export function emptyDraft(featureId: string, categoryId: string): TaskDraft {
    return {
        title: '',
        description: '',
        status: 'TODO',
        featureId,
        categoryId,
        parentTaskId: '',
        tagIds: [],
        sourceGameExceptionId: '',
        planningDocumentRefs: [],
    }
}

export function upsertBodyParentId(d: TaskDraft): string | null {
    const p = d.parentTaskId.trim()
    return p.length > 0 ? p : null
}

export function parentTaskPickerOptions(tasks: Task[], draftFeatureId: string, editingTaskId: string | null): Task[] {
    return tasks
        .filter((t) => {
            const tf = String(t.feature?.id ?? t.featureId ?? '')
            if (tf !== draftFeatureId) return false
            if (editingTaskId && t.id === editingTaskId) return false
            if (editingTaskId && isUnderAncestor(editingTaskId, t.id, tasks)) return false
            return true
        })
        .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
}
