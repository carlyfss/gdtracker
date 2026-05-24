import { useMemo, useState, type CSSProperties } from 'react'
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core'
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { PlanningNodeMeta } from '../../api/planning'
import folderIconBtn from '../../assets/icons/buttons/folder_icon.svg'
import {
    buildTree,
    computeMoveUpdates,
    resolveDropTarget,
    type PlanningNodeMoveUpdate,
    type PlanningTreeEntry,
} from '../../util/planningTree'

export type PlanningTreeProps = {
    nodes: PlanningNodeMeta[]
    /** Parent whose children form the top level (`null` = game root). */
    rootParentId: string | null
    selectedId: string | null
    expanded: ReadonlySet<string>
    onSelect: (id: string) => void
    onToggleExpand: (id: string) => void
    onMove: (updates: PlanningNodeMoveUpdate[]) => Promise<void>
    emptyMessage?: string
    showRootDropZone?: boolean
    className?: string
    /** When true, tree fills available height (folder overview). */
    fill?: boolean
}

type RowProps = {
    entry: PlanningTreeEntry
    depth: number
    selectedId: string | null
    expanded: ReadonlySet<string>
    onSelect: (id: string) => void
    onToggleExpand: (id: string) => void
    isDraggingAny: boolean
}

function depthClass(depth: number): string {
    if (depth <= 6) {
        return `planningTreeRowDepth${depth}`
    }
    return 'planningTreeRowDepthDeep'
}

function depthStyle(depth: number): CSSProperties | undefined {
    if (depth <= 6) {
        return undefined
    }
    return { paddingLeft: `${depth * 12}px` }
}

function KindBadge({ node }: { node: PlanningNodeMeta }) {
    if (node.kind === 'folder') {
        return <img src={folderIconBtn} alt="" className="planningTreeKindIcon" width={18} height={18} />
    }
    if (node.kind === 'markdown') {
        return <>md</>
    }
    return <>✎</>
}

function SortablePlanningRow({
    entry,
    depth,
    selectedId,
    expanded,
    onSelect,
    onToggleExpand,
    isDraggingAny,
}: RowProps) {
    const { node, children } = entry
    const isFolder = node.kind === 'folder'
    const open = expanded.has(node.id)
    const selected = node.id === selectedId

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: node.id,
        data: { type: 'node', nodeId: node.id },
    })

    const intoFolder = useDroppable({
        id: `into:${node.id}`,
        data: { type: 'folder-into', folderId: node.id },
        disabled: !isFolder,
    })

    const style: CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : undefined,
        ...depthStyle(depth),
    }

    return (
        <div ref={setNodeRef} style={style} className="planningTreeNodeWrap">
            <div
                className={`planningTreeRow ${depthClass(depth)}${selected ? ' planningTreeRowSelected' : ''}${
                    isDragging ? ' planningTreeRowDragging' : ''
                }`}
            >
                {isFolder ? (
                    <button
                        type="button"
                        className="planningTreeChevron"
                        aria-expanded={open}
                        aria-label={open ? 'Collapse folder' : 'Expand folder'}
                        onClick={(e) => {
                            e.stopPropagation()
                            onToggleExpand(node.id)
                        }}
                    >
                        {open ? '▾' : '▸'}
                    </button>
                ) : (
                    <span className="planningTreeChevronSpacer" aria-hidden />
                )}
                <button
                    type="button"
                    className="planningTreeDragHandle"
                    aria-label={`Drag ${node.name}`}
                    {...attributes}
                    {...listeners}
                >
                    ⠿
                </button>
                <button
                    type="button"
                    className={`planningTreeLabel${isFolder && intoFolder.isOver ? ' planningTreeLabelDropInto' : ''}`}
                    onClick={() => onSelect(node.id)}
                    title={node.name}
                    ref={isFolder ? intoFolder.setNodeRef : undefined}
                >
                    <span className="planningTreeKind">
                        <KindBadge node={node} />
                    </span>
                    <span className="planningTreeName">{node.name}</span>
                    {isFolder && isDraggingAny ? (
                        <span className="planningTreeDropHint">Drop to move inside</span>
                    ) : null}
                </button>
            </div>
            {isFolder && open && children.length > 0 ? (
                <PlanningTreeBranch
                    entries={children}
                    depth={depth + 1}
                    selectedId={selectedId}
                    expanded={expanded}
                    onSelect={onSelect}
                    onToggleExpand={onToggleExpand}
                    isDraggingAny={isDraggingAny}
                />
            ) : null}
        </div>
    )
}

function PlanningTreeBranch({
    entries,
    depth,
    selectedId,
    expanded,
    onSelect,
    onToggleExpand,
    isDraggingAny,
}: {
    entries: PlanningTreeEntry[]
    depth: number
    selectedId: string | null
    expanded: ReadonlySet<string>
    onSelect: (id: string) => void
    onToggleExpand: (id: string) => void
    isDraggingAny: boolean
}) {
    const ids = useMemo(() => entries.map((e) => e.node.id), [entries])
    return (
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {entries.map((entry) => (
                <SortablePlanningRow
                    key={entry.node.id}
                    entry={entry}
                    depth={depth}
                    selectedId={selectedId}
                    expanded={expanded}
                    onSelect={onSelect}
                    onToggleExpand={onToggleExpand}
                    isDraggingAny={isDraggingAny}
                />
            ))}
        </SortableContext>
    )
}

function RootDropZone({ active }: { active: boolean }) {
    const { setNodeRef, isOver } = useDroppable({
        id: 'into:root',
        data: { type: 'root-into' },
    })
    if (!active) {
        return null
    }
    return (
        <div ref={setNodeRef} className={`planningTreeRootDrop${isOver ? ' planningTreeRootDropActive' : ''}`}>
            Drop here to move to root
        </div>
    )
}

export function PlanningTree({
    nodes,
    rootParentId,
    selectedId,
    expanded,
    onSelect,
    onToggleExpand,
    onMove,
    emptyMessage = 'No documents yet.',
    showRootDropZone = false,
    className,
    fill = false,
}: PlanningTreeProps) {
    const tree = useMemo(() => buildTree(nodes, rootParentId), [nodes, rootParentId])
    const [activeId, setActiveId] = useState<string | null>(null)
    const [moveMessage, setMoveMessage] = useState<string | null>(null)

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    const activeNode = activeId ? nodes.find((n) => n.id === activeId) : undefined

    const onDragStart = (event: DragStartEvent) => {
        setActiveId(String(event.active.id))
        setMoveMessage(null)
    }

    const onDragEnd = async (event: DragEndEvent) => {
        setActiveId(null)
        const draggedId = String(event.active.id)
        const over = event.over
        if (!over) {
            return
        }

        const overId = String(over.id)
        let target: ReturnType<typeof resolveDropTarget>

        if (overId.startsWith('into:')) {
            if (overId === 'into:root') {
                target = resolveDropTarget(nodes, draggedId, overId, 'root-into', false)
            } else {
                target = resolveDropTarget(nodes, draggedId, overId, 'folder-into', false)
            }
        } else {
            target = resolveDropTarget(nodes, draggedId, overId, 'node', false)
        }

        if (!target) {
            setMoveMessage('Cannot move item here.')
            return
        }

        const effectiveParentId = rootParentId != null && target.parentId === null ? rootParentId : target.parentId
        const updates = computeMoveUpdates(nodes, draggedId, effectiveParentId, target.index)
        if (updates.length === 0) {
            return
        }

        const dragged = nodes.find((n) => n.id === draggedId)
        try {
            await onMove(updates)
            setMoveMessage(dragged ? `Moved “${dragged.name}”.` : 'Moved item.')
        } catch {
            setMoveMessage('Failed to move item.')
        }
    }

    const isDraggingAny = activeId != null

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragEnd={(e) => void onDragEnd(e)}
        >
            <div
                className={`planningTreeHost${fill ? ' planningTreeHostFill' : ''}${className ? ` ${className}` : ''}`}
            >
                {moveMessage ? (
                    <p className="planningTreeMoveStatus" aria-live="polite">
                        {moveMessage}
                    </p>
                ) : null}
                {showRootDropZone ? <RootDropZone active={isDraggingAny} /> : null}
                {tree.length === 0 ? (
                    <p className="planningMuted">{emptyMessage}</p>
                ) : (
                    <PlanningTreeBranch
                        entries={tree}
                        depth={0}
                        selectedId={selectedId}
                        expanded={expanded}
                        onSelect={onSelect}
                        onToggleExpand={onToggleExpand}
                        isDraggingAny={isDraggingAny}
                    />
                )}
            </div>
            <DragOverlay dropAnimation={null}>
                {activeNode ? (
                    <div className="planningTreeDragOverlay">
                        <span className="planningTreeKind">
                            <KindBadge node={activeNode} />
                        </span>
                        <span>{activeNode.name}</span>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    )
}
