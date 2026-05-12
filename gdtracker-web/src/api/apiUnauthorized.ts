/** Registered by `ApiUnauthorizedBridge` so axios can react without importing React from `client.ts`. */
let handler: (() => void) | null = null

export function setApiUnauthorizedHandler(fn: (() => void) | null) {
    handler = fn
}

export function notifyApiUnauthorized() {
    handler?.()
}
