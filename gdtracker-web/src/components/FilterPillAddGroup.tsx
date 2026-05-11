import { useId, useMemo } from 'react'

export type FilterPillItem = {
    value: string
    label: string
    swatchColor?: string
}

export type FilterPillAddGroupProps = {
    /** When empty, no section heading is rendered (parent may supply its own). */
    title: string
    selected: FilterPillItem[]
    onRemove: (value: string) => void
    addOptions: FilterPillItem[]
    onAdd: (value: string) => void
    addPlaceholder?: string
    emptyHint?: React.ReactNode
    /** Accessible name for the pill list + add control region */
    ariaLabel?: string
    className?: string
}

function selectedKey(items: FilterPillItem[]) {
    return items.map((x) => x.value).join('\u0000')
}

export function FilterPillAddGroup({
    title,
    selected,
    onRemove,
    addOptions,
    onAdd,
    addPlaceholder = 'Add filter…',
    emptyHint,
    ariaLabel,
    className,
}: FilterPillAddGroupProps) {
    const baseId = useId()
    const listId = `${baseId}-pills`
    const addId = `${baseId}-add`
    const sk = useMemo(() => selectedKey(selected), [selected])

    const regionLabel = ariaLabel ?? (title.trim() ? title : 'Filters')
    const canAdd = addOptions.length > 0

    return (
        <div className={`filterPillAddGroup${className ? ` ${className}` : ''}`.trim()}>
            {title.trim() ? (
                <div className="tasksFilterPanelTitle" id={`${baseId}-title`}>
                    {title}
                </div>
            ) : null}
            {emptyHint}
            <div
                className="filterPillAddGroupBody"
                role="group"
                aria-labelledby={title.trim() ? `${baseId}-title` : undefined}
                aria-label={regionLabel}
            >
                <ul
                    className="filterPillList"
                    id={listId}
                    aria-label={title.trim() ? `${title} selected` : `${regionLabel} selected`}
                >
                    {selected.map((item) => (
                        <li key={item.value} className="filterPill">
                            <span className="filterPillInner">
                                {item.swatchColor ? (
                                    <span className="featureSwatch" style={{ backgroundColor: item.swatchColor }} />
                                ) : null}
                                <span className="filterPillLabel">{item.label}</span>
                                <button
                                    type="button"
                                    className="filterPillRemove"
                                    aria-label={`Remove ${item.label}`}
                                    onClick={() => onRemove(item.value)}
                                >
                                    ×
                                </button>
                            </span>
                        </li>
                    ))}
                </ul>
                {canAdd ? (
                    <select
                        key={`${sk}:${addOptions.map((o) => o.value).join('\u0001')}`}
                        id={addId}
                        className="intervalSelect filterPillAddSelect"
                        defaultValue=""
                        aria-label={title.trim() ? `Add ${title}` : `Add ${regionLabel}`}
                        onChange={(e) => {
                            const v = e.target.value
                            if (!v) return
                            onAdd(v)
                        }}
                    >
                        <option value="">{addPlaceholder}</option>
                        {addOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                ) : null}
            </div>
        </div>
    )
}
