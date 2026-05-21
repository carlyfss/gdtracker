import { TASKS_LIST_PAGE_SIZE_OPTIONS } from '../util/screenFilterPreferences'
import { SelectControl } from './SelectControl'

const LIST_PAGE_SIZE_OPTIONS = TASKS_LIST_PAGE_SIZE_OPTIONS

export type ListPaginationBarProps = {
    pageSize: number
    onPageSizeChange: (size: number) => void
    page: number
    onPageChange: (page: number) => void
    totalElements: number
    contentLength: number
    loading?: boolean
    pageSizeLabel?: string
    idPrefix?: string
}

export function ListPaginationBar({
    pageSize,
    onPageSizeChange,
    page,
    onPageChange,
    totalElements,
    contentLength,
    loading = false,
    pageSizeLabel = 'Page size',
    idPrefix = 'list-pagination',
}: ListPaginationBarProps) {
    const totalPages = Math.max(1, Math.ceil(totalElements / Math.max(1, pageSize)) || 1)
    const currentPage = Math.min(page, Math.max(0, totalPages - 1))
    const canPrev = currentPage > 0
    const canNext = currentPage < totalPages - 1
    const showingFrom = totalElements === 0 ? 0 : currentPage * pageSize + 1
    const showingTo = Math.min(totalElements, currentPage * pageSize + contentLength)

    return (
        <div className="listPaginationBar">
            <label className="listPaginationSizeLabel" htmlFor={`${idPrefix}-size`}>
                {pageSizeLabel}
                <SelectControl
                    id={`${idPrefix}-size`}
                    value={String(pageSize)}
                    onChange={(v) => onPageSizeChange(Number(v))}
                    options={LIST_PAGE_SIZE_OPTIONS.map((opt) => ({
                        value: String(opt),
                        label: String(opt),
                    }))}
                    aria-label={pageSizeLabel}
                />
            </label>
            <div className="listPaginationInfo">
                {totalElements === 0
                    ? '0 results'
                    : `Showing ${showingFrom}–${showingTo} of ${totalElements}`}
            </div>
            <div className="listPaginationControls">
                <button
                    type="button"
                    className="btn"
                    disabled={!canPrev || loading}
                    onClick={() => onPageChange(Math.max(0, currentPage - 1))}
                >
                    Prev
                </button>
                <span className="listPaginationIndicator">
                    Page {currentPage + 1} of {totalPages}
                </span>
                <button
                    type="button"
                    className="btn"
                    disabled={!canNext || loading}
                    onClick={() => onPageChange(currentPage + 1)}
                >
                    Next
                </button>
            </div>
        </div>
    )
}
