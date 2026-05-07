const TRACE_PLACEHOLDER = '<EXCEPTION_TRACE>'
const INDEX_PLACEHOLDER = '<EXCEPTION_INDEX>'
const ID_PLACEHOLDER = '<EXCEPTION_ID>'
const SHORT_ID_PLACEHOLDER = '<EXCEPTION_SHORT_ID>'
const ERROR_MSG_PLACEHOLDER = '<ERROR_MESSAGE>'
const SHORT_MSG_PLACEHOLDER = '<SHORT_ERROR_MESSAGE>'

export type ExceptionTitleContext = {
    exceptionIndex: number
    exceptionId: string
    errorMessage: string
    /** From API `shortErrorMessage`; empty string if unset. */
    shortErrorMessage: string
}

function formatErrorMessageSnippet(msg: string): string {
    const t = (msg ?? '').trim() || 'Unknown error'
    return t.length > 120 ? `${t.slice(0, 117)}…` : t
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
