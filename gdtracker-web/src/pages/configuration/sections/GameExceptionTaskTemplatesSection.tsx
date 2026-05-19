import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Category } from '../../../api/categories'
import { listCategories } from '../../../api/categories'
import { getConfiguration, patchConfiguration } from '../../../api/configuration'
import {
    buildExceptionExamplePayloadForSave,
    extractExceptionPlaceholderTokens,
    previewExceptionTaskTemplates,
} from '../../../util/exceptionTaskTemplate'
import { SelectControl } from '../../../components/SelectControl'
import type { UiState } from '../configurationUtils'

const DEFAULT_TITLE = 'Fix Exception #<EXCEPTION_INDEX>'
const DEFAULT_DESC = '```\n<EXCEPTION_TRACE>\n```'

export function GameExceptionTaskTemplatesSection({ gameId, refreshToken }: { gameId: string; refreshToken: number }) {
    const [state, setState] = useState<UiState>({ kind: 'idle' })
    const [categories, setCategories] = useState<Category[]>([])
    const [titleTemplate, setTitleTemplate] = useState(DEFAULT_TITLE)
    const [descriptionTemplate, setDescriptionTemplate] = useState(DEFAULT_DESC)
    const [defaultCategoryId, setDefaultCategoryId] = useState<string | null>(null)
    const [examples, setExamples] = useState<Record<string, string>>({})

    const load = useCallback(async () => {
        setState({ kind: 'loading', message: 'Loading task templates…' })
        try {
            const [cfg, cats] = await Promise.all([getConfiguration(gameId), listCategories(gameId)])
            setCategories(cats)
            const et = cfg.exceptionTaskTemplate
            setTitleTemplate(et?.titleTemplate ?? DEFAULT_TITLE)
            setDescriptionTemplate(et?.descriptionTemplate ?? DEFAULT_DESC)
            setDefaultCategoryId(et?.defaultCategoryId ?? null)
            setExamples(et?.examplePlaceholderValues ?? {})
            setState({ kind: 'idle' })
        } catch {
            setState({ kind: 'error', message: 'Failed to load task templates.' })
        }
    }, [gameId])

    useEffect(() => {
        const t = window.setTimeout(() => void load(), 0)
        return () => window.clearTimeout(t)
    }, [gameId, refreshToken, load])

    const tokens = useMemo(
        () => extractExceptionPlaceholderTokens(titleTemplate, descriptionTemplate),
        [titleTemplate, descriptionTemplate]
    )

    const preview = useMemo(
        () => previewExceptionTaskTemplates(titleTemplate, descriptionTemplate, examples),
        [titleTemplate, descriptionTemplate, examples]
    )

    const onSave = async () => {
        setState({ kind: 'loading', message: 'Saving task templates…' })
        try {
            const updated = await patchConfiguration(gameId, {
                exceptionTaskTemplate: {
                    titleTemplate,
                    descriptionTemplate,
                    defaultCategoryId: defaultCategoryId && defaultCategoryId.length > 0 ? defaultCategoryId : null,
                    examplePlaceholderValues: buildExceptionExamplePayloadForSave(
                        titleTemplate,
                        descriptionTemplate,
                        examples
                    ),
                },
            })
            const et = updated.exceptionTaskTemplate
            setTitleTemplate(et?.titleTemplate ?? DEFAULT_TITLE)
            setDescriptionTemplate(et?.descriptionTemplate ?? DEFAULT_DESC)
            setDefaultCategoryId(et?.defaultCategoryId ?? null)
            setExamples(et?.examplePlaceholderValues ?? {})
            setState({ kind: 'success', message: 'Task templates saved.' })
        } catch {
            setState({ kind: 'error', message: 'Failed to save task templates.' })
        }
    }

    return (
        <section className="gamePageSection">
            <div className="cardHeader">
                <h2 className="cardTitle">Task templates (from game exceptions)</h2>
            </div>
            <div className="cardBody">
                {state.kind === 'error' && <div className="banner bannerError">{state.message}</div>}
                {state.kind === 'success' && <div className="banner bannerSuccess">{state.message}</div>}
                {state.kind === 'loading' && <div className="banner">{state.message}</div>}

                <p className="muted" style={{ marginBottom: 12 }}>
                    Used when creating tasks from the dashboard exception detail. <strong>Title:</strong>{' '}
                    <code>&lt;EXCEPTION_INDEX&gt;</code> (server-sequenced per game when creating a real task; preview
                    uses your sample below), <code>&lt;EXCEPTION_ID&gt;</code>, <code>&lt;EXCEPTION_SHORT_ID&gt;</code>,{' '}
                    <code>&lt;SHORT_ERROR_MESSAGE&gt;</code> — <code>&lt;ERROR_MESSAGE&gt;</code> is removed from titles
                    if present. <strong>Description:</strong> <code>&lt;EXCEPTION_TRACE&gt;</code> for the stack trace,
                    plus <code>&lt;EXCEPTION_ID&gt;</code>, <code>&lt;EXCEPTION_SHORT_ID&gt;</code>,{' '}
                    <code>&lt;ERROR_MESSAGE&gt;</code>, <code>&lt;SHORT_ERROR_MESSAGE&gt;</code>;{' '}
                    <code>&lt;EXCEPTION_INDEX&gt;</code> is stripped in descriptions.
                </p>

                <div className="gameEventDefinitionCard gameEventDefinitionCardNested" style={{ marginBottom: 20 }}>
                    <div className="modalFormGrid" style={{ marginBottom: 14, maxWidth: 720 }}>
                        <label className="tasksListToolbarLabel" htmlFor="exc-task-title-tpl">
                            Title template
                        </label>
                        <input
                            id="exc-task-title-tpl"
                            className="textInput"
                            value={titleTemplate}
                            onChange={(e) => setTitleTemplate(e.target.value)}
                            autoComplete="off"
                            aria-label="Title template for exception tasks"
                        />
                        <label className="tasksListToolbarLabel" htmlFor="exc-task-desc-tpl">
                            Description template
                        </label>
                        <textarea
                            id="exc-task-desc-tpl"
                            className="textArea modalTaskDescArea"
                            style={{ minHeight: '6rem' }}
                            value={descriptionTemplate}
                            onChange={(e) => setDescriptionTemplate(e.target.value)}
                            aria-label="Description template for exception tasks"
                        />
                        <label className="tasksListToolbarLabel" htmlFor="exc-task-default-cat">
                            Default category for new exception tasks
                        </label>
                        <SelectControl
                            id="exc-task-default-cat"
                            className="excTaskDefaultCatSelect"
                            value={defaultCategoryId ?? ''}
                            onChange={(v) => setDefaultCategoryId(v.length ? v : null)}
                            options={[
                                { value: '', label: 'None' },
                                ...categories.map((c) => ({ value: c.id, label: c.name })),
                            ]}
                            aria-label="Default category for tasks created from exceptions"
                        />
                    </div>

                    {tokens.length > 0 && (
                        <>
                            <div className="gameEventDefinitionCardDivider" />
                            <div className="gameEventDefinitionExampleHead">
                                <span className="gameEventDefinitionCardColLabel" style={{ marginBottom: 0 }}>
                                    Example placeholders
                                </span>
                                <p className="gameEventDefinitionExampleHint">
                                    Sample values for preview only. Saved with the template.
                                </p>
                            </div>
                            <div className="gameEventDefinitionPlaceholderGrid">
                                {tokens.map((token) => (
                                    <div key={token} className="gameEventDefinitionPlaceholderRow">
                                        <label
                                            className="gameEventDefinitionPlaceholderLabel"
                                            htmlFor={`exc-ph-${token}`}
                                        >
                                            {`<${token}>`}
                                        </label>
                                        {token === 'EXCEPTION_TRACE' ? (
                                            <textarea
                                                id={`exc-ph-${token}`}
                                                className="textArea"
                                                style={{ minHeight: '4rem' }}
                                                value={examples[token] ?? ''}
                                                onChange={(e) =>
                                                    setExamples((prev) => ({
                                                        ...prev,
                                                        [token]: e.target.value,
                                                    }))
                                                }
                                                placeholder="Example stack trace"
                                                aria-label={`Example ${token}`}
                                            />
                                        ) : (
                                            <input
                                                id={`exc-ph-${token}`}
                                                className="textInput"
                                                value={examples[token] ?? ''}
                                                onChange={(e) =>
                                                    setExamples((prev) => ({
                                                        ...prev,
                                                        [token]: e.target.value,
                                                    }))
                                                }
                                                placeholder="Example value"
                                                aria-label={`Example ${token}`}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {(titleTemplate.trim() || descriptionTemplate.trim()) && (
                        <>
                            <div className="gameEventDefinitionCardDivider" />
                            {titleTemplate.trim() && (
                                <>
                                    <div className="gameEventDefinitionCardColLabel">Title template</div>
                                    <pre
                                        className="gameEventDefinitionCardPreviewRow"
                                        style={{
                                            margin: 0,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            fontFamily: 'inherit',
                                        }}
                                    >
                                        {titleTemplate}
                                    </pre>
                                    <div className="gameEventDefinitionCardColLabel">Title example</div>
                                    <pre
                                        className="gameEventDefinitionCardPreviewRow"
                                        style={{
                                            margin: 0,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            fontFamily: 'inherit',
                                        }}
                                    >
                                        {preview.ok ? (
                                            preview.title
                                        ) : (
                                            <span className="gameEventDefinitionPreviewError">{preview.error}</span>
                                        )}
                                    </pre>
                                </>
                            )}
                            {descriptionTemplate.trim() && (
                                <>
                                    <div className="gameEventDefinitionCardColLabel">Description template</div>
                                    <pre
                                        className="gameEventDefinitionCardPreviewRow"
                                        style={{
                                            margin: 0,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            fontFamily: 'inherit',
                                        }}
                                    >
                                        {descriptionTemplate}
                                    </pre>
                                    <div className="gameEventDefinitionCardColLabel">Description example</div>
                                    <pre
                                        className="gameEventDefinitionCardPreviewRow"
                                        style={{
                                            margin: 0,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            fontFamily: 'inherit',
                                        }}
                                    >
                                        {preview.ok ? (
                                            preview.description
                                        ) : (
                                            <span className="gameEventDefinitionPreviewError">{preview.error}</span>
                                        )}
                                    </pre>
                                </>
                            )}
                        </>
                    )}
                </div>

                <button
                    type="button"
                    className="btn btnPrimary"
                    disabled={state.kind === 'loading'}
                    onClick={() => void onSave()}
                >
                    Save task templates
                </button>
            </div>
        </section>
    )
}
