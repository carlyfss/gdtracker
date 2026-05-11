/** Mirrors gdtracker-go-api/internal/eventtemplate/template.go limits and placeholder syntax. */

export const MAX_GAME_EVENT_TEMPLATE_CHARS = 100
export const MAX_GAME_EVENT_OUTPUT_CHARS = 100

const placeholderTokenRe = /<([A-Z0-9_]+)>/g

export function normalizeGameEventParameterKeys(raw: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw)) {
        const nk = k.trim().replace(/-/g, '_').toUpperCase()
        if (!nk) continue
        out[nk] = v
    }
    return out
}

export type RenderGameEventTemplateResult = { ok: true; text: string } | { ok: false; error: string }

export function renderGameEventTemplate(
    messageTemplate: string,
    parameters: Record<string, string>
): RenderGameEventTemplateResult {
    const tpl = messageTemplate.trim()
    if (!tpl) {
        return { ok: false, error: 'Message template is required' }
    }
    if (tpl.length > MAX_GAME_EVENT_TEMPLATE_CHARS) {
        return { ok: false, error: `Message template exceeds ${MAX_GAME_EVENT_TEMPLATE_CHARS} characters` }
    }
    const normalized = normalizeGameEventParameterKeys(parameters)
    let out = ''
    let last = 0
    const re = new RegExp(placeholderTokenRe.source, 'g')
    let m: RegExpExecArray | null
    while ((m = re.exec(tpl)) !== null) {
        if (m.index > last) {
            out += tpl.slice(last, m.index)
        }
        const token = m[1]
        const val = normalized[token]
        if (val === undefined) {
            return { ok: false, error: `missing parameter for placeholder <${token}> in template` }
        }
        out += val
        last = m.index + m[0].length
    }
    if (last < tpl.length) {
        out += tpl.slice(last)
    }
    if (out.length > MAX_GAME_EVENT_OUTPUT_CHARS) {
        return { ok: false, error: `Rendered message exceeds ${MAX_GAME_EVENT_OUTPUT_CHARS} characters` }
    }
    return { ok: true, text: out }
}

export function extractPlaceholderTokens(messageTemplate: string): string[] {
    const tpl = messageTemplate.trim()
    const re = new RegExp(placeholderTokenRe.source, 'g')
    const seen = new Set<string>()
    const order: string[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(tpl)) !== null) {
        const t = m[1]
        if (!seen.has(t)) {
            seen.add(t)
            order.push(t)
        }
    }
    return order
}

export function randomSamplePlayerId(): string {
    const bytes = new Uint8Array(8)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function buildExamplePayloadForSave(
    messageTemplate: string,
    examples: Record<string, string>
): Record<string, string> {
    const tokens = extractPlaceholderTokens(messageTemplate)
    const out: Record<string, string> = {}
    for (const t of tokens) {
        if (t === 'PLAYER_ID') continue
        const v = examples[t]?.trim() ?? ''
        if (v.length > 0) {
            out[t] = v
        }
    }
    return out
}
