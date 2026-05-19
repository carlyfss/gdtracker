import { useEffect, useState } from 'react'
import { searchGameExceptions, type GameException, type GameExceptionPage } from '../../../api/gameExceptions'
import { SelectControl } from '../../../components/SelectControl'
import { subtitleForException, titleForException } from '../dashboardPageUtils'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
const SEARCH_DEBOUNCE_MS = 300

type ExceptionSearchPanelProps = {
    gameId: string
    selectedExceptionId: string | null
    onSelect: (ex: GameException) => void
}

export function ExceptionSearchPanel({ gameId, selectedExceptionId, onSelect }: ExceptionSearchPanelProps) {
    const [queryInput, setQueryInput] = useState('')
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const [page, setPage] = useState(0)
    const [size, setSize] = useState<number>(PAGE_SIZE_OPTIONS[0])
    const [data, setData] = useState<GameExceptionPage>({
        content: [],
        totalElements: 0,
        totalPages: 0,
        number: 0,
        size: PAGE_SIZE_OPTIONS[0],
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const handle = window.setTimeout(() => {
            setDebouncedQuery(queryInput)
            setPage(0)
        }, SEARCH_DEBOUNCE_MS)
        return () => window.clearTimeout(handle)
    }, [queryInput])

    useEffect(() => {
        let cancelled = false
        void (async () => {
            setLoading(true)
            setError(null)
            try {
                const res = await searchGameExceptions(gameId, { q: debouncedQuery, page, size })
                if (cancelled) return
                setData(res)
            } catch {
                if (cancelled) return
                setError('Could not load exceptions. Try again.')
                setData({ content: [], totalElements: 0, totalPages: 0, number: page, size })
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [gameId, debouncedQuery, page, size])

    const onChangeSize = (next: number) => {
        setSize(next)
        setPage(0)
    }

    const totalPages = Math.max(1, data.totalPages)
    const currentPage = Math.min(page, Math.max(0, totalPages - 1))
    const canPrev = currentPage > 0
    const canNext = currentPage < totalPages - 1
    const showingFrom = data.totalElements === 0 ? 0 : currentPage * size + 1
    const showingTo = Math.min(data.totalElements, currentPage * size + data.content.length)

    return (
        <div className="exceptionSearchPanel">
            <div className="exceptionSearchHeader">
                <h3 className="dashboardSubheading">Search exceptions</h3>
                <div className="exceptionSearchControls">
                    <input
                        type="search"
                        className="textInput exceptionSearchInput"
                        placeholder="exception id, short id, error message, or stack trace"
                        value={queryInput}
                        onChange={(e) => setQueryInput(e.target.value)}
                        aria-label="Search exceptions"
                    />
                    <label className="exceptionSearchSizeLabel">
                        Page size
                        <SelectControl
                            value={String(size)}
                            onChange={(v) => onChangeSize(Number(v))}
                            options={PAGE_SIZE_OPTIONS.map((opt) => ({
                                value: String(opt),
                                label: String(opt),
                            }))}
                            aria-label="Exception search page size"
                        />
                    </label>
                </div>
            </div>

            {error && (
                <div className="banner bannerError" role="status">
                    {error}
                </div>
            )}

            <div className="exceptionList exceptionSearchList" role="list">
                {loading && <div className="emptyState">Loading…</div>}
                {!loading && data.content.length === 0 && (
                    <div className="emptyState">
                        {debouncedQuery.trim().length > 0 ? 'No exceptions match your search.' : 'No exceptions yet.'}
                    </div>
                )}
                {!loading &&
                    data.content.map((ex) => {
                        const id = String(ex.id ?? '')
                        const active = selectedExceptionId != null && id === selectedExceptionId
                        return (
                            <button
                                key={id || subtitleForException(ex)}
                                type="button"
                                className="exceptionListItem"
                                data-active={active}
                                onClick={() => onSelect(ex)}
                            >
                                <div className="exceptionItemTitle">{titleForException(ex)}</div>
                                <div className="exceptionItemSubtitle">{subtitleForException(ex)}</div>
                            </button>
                        )
                    })}
            </div>

            <div className="exceptionSearchPagination">
                <div className="exceptionSearchPageInfo">
                    {data.totalElements === 0
                        ? '0 results'
                        : `Showing ${showingFrom}–${showingTo} of ${data.totalElements}`}
                </div>
                <div className="exceptionSearchPageControls">
                    <button
                        type="button"
                        className="btn"
                        disabled={!canPrev || loading}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                        Prev
                    </button>
                    <span className="exceptionSearchPageIndicator">
                        Page {currentPage + 1} of {totalPages}
                    </span>
                    <button
                        type="button"
                        className="btn"
                        disabled={!canNext || loading}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    )
}
