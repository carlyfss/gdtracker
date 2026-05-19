import { useId, useMemo } from 'react'
import { SelectControl } from './SelectControl'

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
    const regionLabel = ariaLabel ?? (title.trim() ? title : 'Filters')
    const canAdd = addOptions.length > 0

    const addSelectOptions = useMemo(
        () => addOptions.map((opt) => ({ value: opt.value, label: opt.label })),
        [addOptions]
    )

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
                    <SelectControl
                        id={addId}
                        className="filterPillAddSelect"
                        value=""
                        placeholder={addPlaceholder}
                        resetAfterChange
                        options={addSelectOptions}
                        onChange={(v) => {
                            if (!v) return
                            onAdd(v)
                        }}
                        aria-label={title.trim() ? `Add ${title}` : `Add ${regionLabel}`}
                    />
                ) : null}
            </div>
        </div>
    )
}
