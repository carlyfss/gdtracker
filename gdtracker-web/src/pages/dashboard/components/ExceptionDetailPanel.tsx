import type { GameException } from '../../../api/gameExceptions'
import { subtitleForException, titleForException } from '../dashboardPageUtils'

type ExceptionDetailPanelProps = {
    selectedException: GameException | null
    linkedTaskId: string | null
    createTaskBusy: boolean
    onCreateTask: () => void
    onGoToTask: () => void
}

export function ExceptionDetailPanel({
    selectedException,
    linkedTaskId,
    createTaskBusy,
    onCreateTask,
    onGoToTask,
}: ExceptionDetailPanelProps) {
    return (
        <div className="dashboardExceptionDetail cardLikeInset">
            <div className="splitPanelHeader" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <div className="splitPanelTitle">Exception detail</div>
            </div>
            {!selectedException && (
                <div className="emptyState" style={{ padding: '8px 4px' }}>
                    Select an exception above to view details.
                </div>
            )}
            {selectedException && (
                <div className="exceptionDetail">
                    <div className="exceptionDetailTitle">{titleForException(selectedException)}</div>
                    <div className="exceptionDetailSubtitle">{subtitleForException(selectedException)}</div>
                    <pre className="stackTrace">
                        {typeof selectedException.stackTrace === 'string' &&
                        selectedException.stackTrace.trim().length > 0
                            ? selectedException.stackTrace
                            : 'No stack trace'}
                    </pre>
                    {linkedTaskId ? (
                        <button type="button" className="btn btnSuccess" style={{ marginTop: 12 }} onClick={onGoToTask}>
                            Go to Exception Task
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="btn btnPrimary"
                            style={{ marginTop: 12 }}
                            disabled={createTaskBusy}
                            onClick={onCreateTask}
                        >
                            Create Task for Exception
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
