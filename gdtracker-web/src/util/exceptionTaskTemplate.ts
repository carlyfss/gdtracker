const TRACE_PLACEHOLDER = '<EXCEPTION_TRACE>'
const INDEX_PLACEHOLDER = '<EXCEPTION_INDEX>'
const ID_PLACEHOLDER = '<EXCEPTION_ID>'
const SHORT_ID_PLACEHOLDER = '<EXCEPTION_SHORT_ID>'
const ERROR_MSG_PLACEHOLDER = '<ERROR_MESSAGE>'
const SHORT_MSG_PLACEHOLDER = '<SHORT_ERROR_MESSAGE>'

const KNOWN_EXCEPTION_PLACEHOLDERS = [
    'EXCEPTION_INDEX',
    'EXCEPTION_ID',
    'EXCEPTION_SHORT_ID',
    'EXCEPTION_TRACE',
    'ERROR_MESSAGE',
    'SHORT_ERROR_MESSAGE',
] as const

const placeholderTokenRe = /<([A-Z0-9_]+)>/g

export type ExceptionTitleContext = {
    exceptionIndex: number
    exceptionId: string
    errorMessage: string
    /** From API `shortErrorMessage`; empty string if unset. */
    shortErrorMessage: string
}

export type PreviewExceptionTaskTemplatesResult =
    | { ok: true; title: string; description: string }
    | { ok: false; error: string }

const DEFAULT_PREVIEW_EXCEPTION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const DEFAULT_PREVIEW_TRACE = 'at Game.run (main.gd:42)\nat Player.jump (player.gd:10)'
const DEFAULT_PREVIEW_ERROR = 'Null reference: player node was freed'
const DEFAULT_PREVIEW_SHORT_ERROR = 'Null reference'

function formatErrorMessageSnippet(msg: string): string {
    const t = (msg ?? '').trim() || 'Unknown error'
    return t.length > 120 ? `${t.slice(0, 117)}…` : t
}

function extractTokensFromTemplate(template: string): string[] {
    const tpl = template.trim()
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

/** Ordered union of known exception placeholders appearing in title and/or description templates. */
export function extractExceptionPlaceholderTokens(titleTpl: string, descTpl: string): string[] {
    const seen = new Set<string>()
    const order: string[] = []
    const add = (token: string) => {
        if (!KNOWN_EXCEPTION_PLACEHOLDERS.includes(token as (typeof KNOWN_EXCEPTION_PLACEHOLDERS)[number])) {
            return
        }
        if (!seen.has(token)) {
            seen.add(token)
            order.push(token)
        }
    }
    for (const t of extractTokensFromTemplate(titleTpl)) {
        add(t)
    }
    for (const t of extractTokensFromTemplate(descTpl)) {
        add(t)
    }
    return order
}

function normalizeExampleKey(raw: string): string {
    return raw.trim().replace(/-/g, '_').toUpperCase()
}

function parseExceptionIndex(raw: string): number {
    const t = raw.trim()
    if (!t) return 3
    const n = Number.parseInt(t, 10)
    if (!Number.isFinite(n) || n < 1) return 3
    return n
}

/** Build runtime context from configuration preview examples (with defaults for empty fields). */
export function examplesToExceptionContext(examples: Record<string, string>): {
    ctx: ExceptionTitleContext
    trace: string
} {
    const norm: Record<string, string> = {}
    for (const [k, v] of Object.entries(examples)) {
        const nk = normalizeExampleKey(k)
        if (nk) norm[nk] = v
    }
    const exceptionId = (norm.EXCEPTION_ID ?? '').trim() || DEFAULT_PREVIEW_EXCEPTION_ID
    const errorMessage = (norm.ERROR_MESSAGE ?? '').trim() || DEFAULT_PREVIEW_ERROR
    const shortErrorMessage = (norm.SHORT_ERROR_MESSAGE ?? '').trim() || DEFAULT_PREVIEW_SHORT_ERROR
    const trace = (norm.EXCEPTION_TRACE ?? '').trim() || DEFAULT_PREVIEW_TRACE
    return {
        ctx: {
            exceptionIndex: parseExceptionIndex(norm.EXCEPTION_INDEX ?? ''),
            exceptionId,
            errorMessage,
            shortErrorMessage,
        },
        trace,
    }
}

export function buildExceptionExamplePayloadForSave(
    titleTpl: string,
    descTpl: string,
    examples: Record<string, string>
): Record<string, string> {
    const tokens = extractExceptionPlaceholderTokens(titleTpl, descTpl)
    const out: Record<string, string> = {}
    for (const t of tokens) {
        const v = examples[t]?.trim() ?? ''
        if (v.length > 0) {
            out[t] = v
        }
    }
    return out
}

export function previewExceptionTaskTemplates(
    titleTpl: string,
    descTpl: string,
    examples: Record<string, string>
): PreviewExceptionTaskTemplatesResult {
    const title = titleTpl.trim()
    const desc = descTpl.trim()
    if (!title && !desc) {
        return { ok: false, error: 'Enter a title or description template to preview.' }
    }
    const { ctx, trace } = examplesToExceptionContext(examples)
    const renderedTitle = title ? applyExceptionTaskTitleTemplate(title, ctx) : ''
    const renderedDesc = desc ? applyExceptionTaskDescriptionTemplate(desc, trace, ctx) : ''
    return { ok: true, title: renderedTitle, description: renderedDesc }
}

/**
 * Title: INDEX, ID, SHORT_ID, SHORT_ERROR_MESSAGE. ERROR_MESSAGE stripped from titles.
 * Description: ID, SHORT_ID, ERROR_MESSAGE, SHORT_ERROR_MESSAGE; INDEX stripped.
 */
function applyExceptionCommonPlaceholders(
    template: string,
    ctx: ExceptionTitleContext,
    mode: 'title' | 'description'
): string {
    let out = template
    if (mode === 'title') {
        out = out.split(ERROR_MSG_PLACEHOLDER).join('')
        const indexStr = String(Math.max(1, ctx.exceptionIndex)).padStart(2, '0')
        out = out.split(INDEX_PLACEHOLDER).join(indexStr)
    } else {
        out = out.split(INDEX_PLACEHOLDER).join('')
        out = out.split(ERROR_MSG_PLACEHOLDER).join(formatErrorMessageSnippet(ctx.errorMessage))
    }
    const compact = ctx.exceptionId.replace(/-/g, '')
    const shortId = compact.length >= 8 ? compact.slice(0, 8) : ctx.exceptionId
    const shortErr = (ctx.shortErrorMessage ?? '').trim()
    out = out.split(SHORT_MSG_PLACEHOLDER).join(shortErr)
    out = out.split(ID_PLACEHOLDER).join(ctx.exceptionId)
    out = out.split(SHORT_ID_PLACEHOLDER).join(shortId)
    return out
}

export function applyExceptionTaskDescriptionTemplate(
    template: string,
    trace: string,
    ctx: Pick<ExceptionTitleContext, 'exceptionId' | 'errorMessage' | 'shortErrorMessage'>
): string {
    const t = trace.trim().length > 0 ? trace : 'No stack trace'
    let base = template
    if (base.includes(TRACE_PLACEHOLDER)) {
        base = base.split(TRACE_PLACEHOLDER).join(t)
    } else {
        base = `${base}\n\n${t}`
    }
    return applyExceptionCommonPlaceholders(
        base,
        {
            exceptionIndex: 0,
            exceptionId: ctx.exceptionId,
            errorMessage: ctx.errorMessage,
            shortErrorMessage: ctx.shortErrorMessage,
        },
        'description'
    )
}

export function applyExceptionTaskTitleTemplate(template: string, ctx: ExceptionTitleContext): string {
    return applyExceptionCommonPlaceholders(template, ctx, 'title')
}
