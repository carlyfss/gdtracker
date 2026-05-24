import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
    createPlanningNode,
    deletePlanningNode,
    getPlanningNode,
    listPlanningNodes,
    updatePlanningNode,
    type PlanningKind,
    type PlanningNodeDetail,
    type PlanningNodeMeta,
} from '../../api/planning'
import { describeApiError } from '../../api/errors'
import deleteTrashIcon from '../../assets/icons/delete_trash.svg'
import folderIconBtn from '../../assets/icons/buttons/folder_icon.svg'
import newDocumentIconBtn from '../../assets/icons/buttons/new_document_button.svg'
import newDrawingIconBtn from '../../assets/icons/buttons/new_drawing_button.svg'
import editPencilIcon from '../../assets/icons/edit_pencil.svg'
import previewEyeIcon from '../../assets/icons/preview_eye.svg'
import saveDocumentIcon from '../../assets/icons/save_document.svg'
import { TaskDescriptionMarkdown } from '../../components/TaskDescriptionMarkdown'
import { serializePlanningExcalidrawSceneForCompare } from '../../util/planningExcalidrawScene'
import { nextDefaultPlanningNodeName } from '../../util/planningDefaultNames'
import { applyMoveUpdates, getAncestors, type PlanningNodeMoveUpdate } from '../../util/planningTree'
import { PlanningTree } from './PlanningTree'
import './planningPage.css'

const PlanningExcalidrawPanel = lazy(async () => {
    const m = await import('./PlanningExcalidrawPanel')
    return { default: m.PlanningExcalidrawPanel }
})

function useDebouncedCallback<A extends unknown[]>(
    cb: (...args: A) => void | Promise<void>,
    ms: number
): (...args: A) => void {
    const cbRef = useRef(cb)
    useEffect(() => {
        cbRef.current = cb
    }, [cb])
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    return useCallback(
        (...args: A) => {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
            }
            timerRef.current = setTimeout(() => {
                timerRef.current = null
                void cbRef.current(...args)
            }, ms)
        },
        [ms]
    )
}

function formatSavedAt(iso: string): string {
    try {
        const d = new Date(iso)
        if (Number.isNaN(d.getTime())) {
            return ''
        }
        return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
    } catch {
        return ''
    }
}

export function PlanningPage() {
    const { gameId: rawGameId } = useParams<{ gameId: string }>()
    const gameId = rawGameId ?? ''
    const [searchParams, setSearchParams] = useSearchParams()

    const [nodes, setNodes] = useState<PlanningNodeMeta[]>([])
    const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('doc'))
    const [detail, setDetail] = useState<PlanningNodeDetail | null>(null)
    const [titleEdit, setTitleEdit] = useState(false)
    const [mdMode, setMdMode] = useState<'edit' | 'preview'>('preview')
    const [markdownDraft, setMarkdownDraft] = useState('')
    const [banner, setBanner] = useState<string | null>(null)
    const [loadingList, setLoadingList] = useState(true)
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

    const [excalidrawSeed, setExcalidrawSeed] = useState<{
        id: string
        scene: Record<string, unknown> | null
    } | null>(null)
    const [excalidrawNonce, setExcalidrawNonce] = useState(0)

    const excalidrawSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const excalidrawPendingRef = useRef<{ nodeId: string; scene: Record<string, unknown> } | null>(null)
    const excalidrawBaselineSerializedRef = useRef<string>('')

    const [drawingSaveStatus, setDrawingSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
    const [drawingSaveHint, setDrawingSaveHint] = useState<string | null>(null)

    const clearExcalidrawSaveTimer = useCallback(() => {
        if (excalidrawSaveTimerRef.current) {
            clearTimeout(excalidrawSaveTimerRef.current)
            excalidrawSaveTimerRef.current = null
        }
    }, [])

    useEffect(() => {
        return () => {
            clearExcalidrawSaveTimer()
        }
    }, [clearExcalidrawSaveTimer])

    const loadDetail = useCallback(
        async (id: string) => {
            if (!gameId) {
                return
            }
            await Promise.resolve()
            setLoadingDetail(true)
            setBanner(null)
            try {
                const d = await getPlanningNode(gameId, id)
                setDetail(d)
                setMarkdownDraft(d.markdownBody ?? '')
                if (d.kind === 'excalidraw') {
                    clearExcalidrawSaveTimer()
                    excalidrawPendingRef.current = null
                    excalidrawBaselineSerializedRef.current = serializePlanningExcalidrawSceneForCompare(
                        d.excalidrawScene
                    )
                    setExcalidrawSeed({ id: d.id, scene: d.excalidrawScene })
                    setExcalidrawNonce((n) => n + 1)
                    setDrawingSaveStatus('idle')
                    setDrawingSaveHint(null)
                } else {
                    setExcalidrawSeed(null)
                    setDrawingSaveStatus('idle')
                    setDrawingSaveHint(null)
                }
            } catch (e) {
                setBanner(describeApiError(e, 'Failed to load document.'))
                setDetail(null)
            } finally {
                setLoadingDetail(false)
            }
        },
        [gameId, clearExcalidrawSaveTimer]
    )

    useEffect(() => {
        let cancelled = false
        const run = async () => {
            if (!selectedId) {
                await Promise.resolve()
                if (!cancelled) {
                    setDetail(null)
                    setExcalidrawSeed(null)
                }
                return
            }
            await loadDetail(selectedId)
        }
        void run()
        return () => {
            cancelled = true
        }
    }, [selectedId, loadDetail])

    const refreshList = useCallback(async () => {
        await Promise.resolve()
        if (!gameId) {
            return
        }
        setBanner(null)
        try {
            const list = await listPlanningNodes(gameId)
            setNodes(list)
        } catch (e) {
            setBanner(describeApiError(e, 'Failed to load documents.'))
        } finally {
            setLoadingList(false)
        }
    }, [gameId])

    useEffect(() => {
        const t = window.setTimeout(() => {
            void refreshList()
        }, 0)
        return () => window.clearTimeout(t)
    }, [refreshList])

    const setDocQuery = useCallback(
        (id: string | null) => {
            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev)
                    if (id) {
                        next.set('doc', id)
                    } else {
                        next.delete('doc')
                    }
                    return next
                },
                { replace: true }
            )
        },
        [setSearchParams]
    )

    const folderAncestors = useMemo(() => {
        if (!detail || detail.kind !== 'folder') {
            return []
        }
        return getAncestors(nodes, detail.id)
    }, [nodes, detail])

    const onMove = useCallback(
        async (updates: PlanningNodeMoveUpdate[]) => {
            if (!gameId || updates.length === 0) {
                return
            }
            const snapshot = nodes
            setNodes(applyMoveUpdates(nodes, updates))
            setBanner(null)
            try {
                await Promise.all(
                    updates.map((u) =>
                        updatePlanningNode(gameId, u.id, { parentId: u.parentId, sortOrder: u.sortOrder })
                    )
                )
                await refreshList()
                setExpanded((prev) => {
                    const next = new Set(prev)
                    for (const u of updates) {
                        if (u.parentId) {
                            next.add(u.parentId)
                        }
                    }
                    return next
                })
            } catch (e) {
                setNodes(snapshot)
                setBanner(describeApiError(e, 'Failed to move item.'))
                throw e
            }
        },
        [gameId, nodes, refreshList]
    )

    const toggleExpand = (id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    const defaultParentId = useMemo((): string | null => {
        if (!selectedId) {
            return null
        }
        const sel = nodes.find((n) => n.id === selectedId)
        if (!sel) {
            return null
        }
        if (sel.kind === 'folder') {
            return sel.id
        }
        return sel.parentId
    }, [nodes, selectedId])

    const saveMarkdownRemote = useCallback(
        async (body: string, id: string) => {
            if (!gameId) {
                return
            }
            try {
                const d = await updatePlanningNode(gameId, id, { markdownBody: body })
                setDetail(d)
                await refreshList()
            } catch (e) {
                setBanner(describeApiError(e, 'Failed to save markdown.'))
            }
        },
        [gameId, refreshList]
    )

    const performExcalidrawSave = useCallback(async () => {
        const pending = excalidrawPendingRef.current
        if (!pending || !gameId) {
            return
        }
        if (detail?.kind !== 'excalidraw' || detail.id !== pending.nodeId) {
            excalidrawPendingRef.current = null
            return
        }
        setDrawingSaveStatus('saving')
        setDrawingSaveHint(null)
        try {
            const d = await updatePlanningNode(gameId, pending.nodeId, { excalidrawScene: pending.scene })
            setDetail(d)
            excalidrawBaselineSerializedRef.current = serializePlanningExcalidrawSceneForCompare(d.excalidrawScene)
            await refreshList()
            excalidrawPendingRef.current = null
            setDrawingSaveStatus('saved')
            const ts = formatSavedAt(d.updatedAt)
            setDrawingSaveHint(ts ? `Saved ${ts}` : 'Saved')
        } catch (e) {
            const msg = describeApiError(e, 'Failed to save drawing.')
            setDrawingSaveStatus('error')
            setDrawingSaveHint(msg)
            setBanner(msg)
        }
    }, [gameId, detail, refreshList])

    const queueExcalidrawAutosave = useCallback(
        (scene: Record<string, unknown>, nodeId: string) => {
            let clone: Record<string, unknown>
            try {
                clone = JSON.parse(JSON.stringify(scene)) as Record<string, unknown>
            } catch {
                return
            }
            excalidrawPendingRef.current = { nodeId, scene: clone }
            setDrawingSaveHint(null)
            clearExcalidrawSaveTimer()
            excalidrawSaveTimerRef.current = setTimeout(() => {
                excalidrawSaveTimerRef.current = null
                void performExcalidrawSave()
            }, 800)
        },
        [clearExcalidrawSaveTimer, performExcalidrawSave]
    )

    const saveDrawingNow = useCallback(() => {
        clearExcalidrawSaveTimer()
        if (!excalidrawPendingRef.current) {
            setDrawingSaveHint('Nothing to save yet — make a change first.')
            setDrawingSaveStatus('idle')
            return
        }
        void performExcalidrawSave()
    }, [clearExcalidrawSaveTimer, performExcalidrawSave])

    const persistMarkdown = useDebouncedCallback(saveMarkdownRemote, 600)

    const onSelect = (id: string) => {
        clearExcalidrawSaveTimer()
        excalidrawPendingRef.current = null
        setDrawingSaveStatus('idle')
        setDrawingSaveHint(null)
        setSelectedId(id)
        setDocQuery(id)
        setTitleEdit(false)
        setMdMode('preview')
        setBanner(null)
    }

    const onCreate = async (kind: PlanningKind) => {
        if (!gameId) {
            return
        }
        const parentId = defaultParentId
        const siblings = nodes.filter((n) => n.parentId === parentId)
        const name = nextDefaultPlanningNodeName(siblings, kind)
        try {
            const d = await createPlanningNode(gameId, {
                kind,
                name,
                parentId,
                markdownBody: kind === 'markdown' ? '' : undefined,
                excalidrawScene: kind === 'excalidraw' ? {} : undefined,
            })
            await refreshList()
            if (parentId) {
                setExpanded((s) => new Set(s).add(parentId))
            }
            onSelect(d.id)
            if (kind === 'markdown') {
                setTitleEdit(true)
                setMdMode('edit')
            }
        } catch {
            setBanner('Failed to create document.')
        }
    }

    const onDelete = async () => {
        if (!gameId || !selectedId || !detail) {
            return
        }
        if (!window.confirm(`Delete “${detail.name}”? Child items under a folder are deleted too.`)) {
            return
        }
        try {
            await deletePlanningNode(gameId, selectedId)
            setSelectedId(null)
            setDocQuery(null)
            setDetail(null)
            await refreshList()
        } catch {
            setBanner('Failed to delete.')
        }
    }

    const onTitleCommit = async (raw: string) => {
        if (!gameId || !detail) {
            return
        }
        const name = raw.trim()
        if (!name) {
            setBanner('Name cannot be empty.')
            return
        }
        setTitleEdit(false)
        try {
            const d = await updatePlanningNode(gameId, detail.id, { name })
            setDetail(d)
            await refreshList()
        } catch {
            setBanner('Failed to rename.')
        }
    }

    const onMarkdownChange = (v: string) => {
        setMarkdownDraft(v)
        if (selectedId) {
            persistMarkdown(v, selectedId)
        }
    }

    const onExcalidrawScene = (scene: Record<string, unknown>) => {
        if (selectedId && detail?.kind === 'excalidraw' && detail.id === selectedId) {
            const incoming = serializePlanningExcalidrawSceneForCompare(scene)
            if (incoming === excalidrawBaselineSerializedRef.current) {
                clearExcalidrawSaveTimer()
                excalidrawPendingRef.current = null
                return
            }
            queueExcalidrawAutosave(scene, selectedId)
        }
    }

    const rightHeader = () => {
        if (!detail) {
            return null
        }
        const deleteButton = (
            <button
                type="button"
                className="btn btnDanger planningIconBtn planningIconBtnOnly"
                onClick={() => void onDelete()}
                aria-label="Delete document"
                title="Delete"
            >
                <img src={deleteTrashIcon} alt="" className="planningToolbarIcon" width={18} height={18} />
            </button>
        )
        return (
            <div className="planningEditorHeader">
                <div className="planningEditorHeaderTop">
                    {titleEdit ? (
                        <input
                            className="textInput planningTitleInput"
                            aria-label="Document name"
                            defaultValue={detail.name}
                            key={detail.id}
                            autoFocus
                            onBlur={(e) => void onTitleCommit(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault()
                                    ;(e.target as HTMLInputElement).blur()
                                }
                                if (e.key === 'Escape') {
                                    setTitleEdit(false)
                                }
                            }}
                        />
                    ) : (
                        <button
                            type="button"
                            className="planningTitleButton"
                            onClick={() => setTitleEdit(true)}
                            title="Rename"
                        >
                            {detail.name}
                        </button>
                    )}
                    {detail.kind === 'excalidraw' ? (
                        <div className="planningHeaderTrailing">
                            <span className="planningSaveStatus planningSaveStatusInline" aria-live="polite">
                                {drawingSaveStatus === 'saving' ? 'Saving…' : null}
                                {drawingSaveStatus === 'saved' ? drawingSaveHint : null}
                                {drawingSaveStatus === 'error' ? drawingSaveHint : null}
                                {drawingSaveStatus === 'idle' && drawingSaveHint ? drawingSaveHint : null}
                                {drawingSaveStatus === 'idle' && !drawingSaveHint ? '\u00a0' : null}
                            </span>
                            <div className="planningEditorHeaderActions">
                                <button
                                    type="button"
                                    className="btn planningIconBtn planningIconBtnOnly"
                                    onClick={saveDrawingNow}
                                    aria-label="Save drawing"
                                    title="Save drawing"
                                >
                                    <img
                                        src={saveDocumentIcon}
                                        alt=""
                                        className="planningToolbarIcon"
                                        width={18}
                                        height={18}
                                    />
                                </button>
                                {deleteButton}
                            </div>
                        </div>
                    ) : null}
                    {detail.kind === 'markdown' ? (
                        <div className="planningEditorHeaderActions">
                            <button
                                type="button"
                                className="btn planningIconBtn planningIconBtnOnly"
                                onClick={() => setMdMode((m) => (m === 'edit' ? 'preview' : 'edit'))}
                                aria-label={mdMode === 'edit' ? 'Preview markdown' : 'Edit markdown'}
                                title={mdMode === 'edit' ? 'Preview' : 'Edit'}
                            >
                                <img
                                    src={mdMode === 'edit' ? previewEyeIcon : editPencilIcon}
                                    alt=""
                                    className="planningToolbarIcon"
                                    width={18}
                                    height={18}
                                />
                            </button>
                            {deleteButton}
                        </div>
                    ) : null}
                    {detail.kind === 'folder' ? (
                        <div className="planningEditorHeaderActions">{deleteButton}</div>
                    ) : null}
                </div>
            </div>
        )
    }

    const rightBody = () => {
        if (loadingDetail && selectedId) {
            return <p className="planningMuted">Loading…</p>
        }
        if (!detail) {
            return <p className="planningMuted">Select a document or create one.</p>
        }
        if (detail.kind === 'folder') {
            return (
                <div className="planningFolderOverview">
                    {folderAncestors.length > 0 ? (
                        <nav className="planningBreadcrumb" aria-label="Folder path">
                            {folderAncestors.map((a) => (
                                <span key={a.id} className="planningBreadcrumbSegment">
                                    <button
                                        type="button"
                                        className="planningBreadcrumbLink"
                                        onClick={() => onSelect(a.id)}
                                    >
                                        {a.name}
                                    </button>
                                    <span className="planningBreadcrumbSep" aria-hidden>
                                        /
                                    </span>
                                </span>
                            ))}
                            <span className="planningBreadcrumbCurrent">{detail.name}</span>
                        </nav>
                    ) : null}
                    <PlanningTree
                        nodes={nodes}
                        rootParentId={detail.id}
                        selectedId={selectedId}
                        expanded={expanded}
                        onSelect={onSelect}
                        onToggleExpand={toggleExpand}
                        onMove={onMove}
                        fill
                        emptyMessage="This folder is empty. Use the toolbar to create documents inside."
                    />
                </div>
            )
        }
        if (detail.kind === 'markdown') {
            if (mdMode === 'preview') {
                return (
                    <div className="planningMdPreview">
                        <TaskDescriptionMarkdown markdown={markdownDraft} />
                    </div>
                )
            }
            return (
                <textarea
                    className="planningMdEditor textInput"
                    value={markdownDraft}
                    spellCheck={false}
                    aria-label="Markdown source"
                    onChange={(e) => onMarkdownChange(e.target.value)}
                />
            )
        }
        if (detail.kind === 'excalidraw' && excalidrawSeed && excalidrawSeed.id === detail.id) {
            return (
                <Suspense
                    key={`${excalidrawSeed.id}-${excalidrawNonce}`}
                    fallback={<p className="planningMuted">Loading drawing editor…</p>}
                >
                    <PlanningExcalidrawPanel
                        docKey={`${excalidrawSeed.id}-${excalidrawNonce}`}
                        scene={excalidrawSeed.scene}
                        onSceneChange={onExcalidrawScene}
                    />
                </Suspense>
            )
        }
        return null
    }

    return (
        <section className="gamePageSection planningPage">
            {banner ? (
                <div className="planningBanner" role="alert">
                    {banner}
                </div>
            ) : null}
            <div className="planningSplit">
                <aside className="planningSidebar">
                    <div className="planningSidebarHeader">Documents</div>
                    <div className="planningToolbar">
                        <button
                            type="button"
                            className="btn planningIconBtn planningIconBtnOnly"
                            onClick={() => void onCreate('folder')}
                            aria-label="New folder"
                            title="New folder"
                        >
                            <img src={folderIconBtn} alt="" className="planningToolbarIcon" width={20} height={20} />
                        </button>
                        <button
                            type="button"
                            className="btn planningIconBtn planningIconBtnOnly"
                            onClick={() => void onCreate('markdown')}
                            aria-label="New markdown"
                            title="New markdown"
                        >
                            <img
                                src={newDocumentIconBtn}
                                alt=""
                                className="planningToolbarIcon"
                                width={20}
                                height={20}
                            />
                        </button>
                        <button
                            type="button"
                            className="btn planningIconBtn planningIconBtnOnly"
                            onClick={() => void onCreate('excalidraw')}
                            aria-label="New drawing"
                            title="New drawing"
                        >
                            <img
                                src={newDrawingIconBtn}
                                alt=""
                                className="planningToolbarIcon"
                                width={20}
                                height={20}
                            />
                        </button>
                    </div>
                    <div className="planningTree">
                        {loadingList ? (
                            <p className="planningMuted">Loading…</p>
                        ) : (
                            <PlanningTree
                                nodes={nodes}
                                rootParentId={null}
                                selectedId={selectedId}
                                expanded={expanded}
                                onSelect={onSelect}
                                onToggleExpand={toggleExpand}
                                onMove={onMove}
                                showRootDropZone
                                emptyMessage="No documents yet."
                            />
                        )}
                    </div>
                </aside>
                <div className="planningMain">
                    <div className="planningMainHeader">{rightHeader()}</div>
                    <div
                        className={
                            detail?.kind === 'excalidraw'
                                ? 'planningMainBody planningMainBody--excal'
                                : detail?.kind === 'folder'
                                  ? 'planningMainBody planningMainBody--folder'
                                  : 'planningMainBody'
                        }
                    >
                        {rightBody()}
                    </div>
                </div>
            </div>
        </section>
    )
}
