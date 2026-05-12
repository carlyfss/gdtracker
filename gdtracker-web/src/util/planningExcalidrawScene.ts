/** Excalidraw expects `appState.collaborators` to be an array; JSON round-trip can leave `{}` or null. */
export function sanitizePlanningExcalidrawAppState(app: object): Record<string, unknown> {
    const raw = app as Record<string, unknown>
    const out = { ...raw }
    if (!Array.isArray(out.collaborators)) {
        out.collaborators = []
    }
    return out
}

/** Same persisted shape as `PlanningExcalidrawPanel` `onSceneChange`. */
export function canonicalPlanningExcalidrawScene(scene: Record<string, unknown> | null): Record<string, unknown> {
    const els = scene && Array.isArray(scene.elements) ? scene.elements : []
    const rawApp =
        scene && typeof scene.appState === 'object' && scene.appState != null ? (scene.appState as object) : {}
    const app = sanitizePlanningExcalidrawAppState(rawApp)
    const files = scene && scene.files && typeof scene.files === 'object' ? scene.files : null
    return {
        elements: els,
        appState: app,
        files,
    }
}

function stableStringify(value: unknown): string {
    if (value === undefined) {
        return 'null'
    }
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value)
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => stableStringify(v)).join(',')}]`
    }
    const o = value as Record<string, unknown>
    const keys = Object.keys(o)
        .sort()
        .filter((k) => o[k] !== undefined)
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`
}

/** Deterministic string for dirty checks (key order independent). */
export function serializePlanningExcalidrawSceneForCompare(scene: Record<string, unknown> | null): string {
    return stableStringify(canonicalPlanningExcalidrawScene(scene))
}
