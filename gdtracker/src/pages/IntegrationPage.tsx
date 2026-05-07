import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getIngestTokenStatus } from '../api/gameEvents'
import { getIntegrationStatus } from '../api/integration'
import { useGameId } from '../context/GameIdContext'

const VALIDATION_BODY_JSON = '{"validation":"ok"}'

function getSuggestedApiBaseUrl(): string {
    const proxy = import.meta.env.VITE_DEV_PROXY_TARGET
    if (typeof proxy === 'string' && proxy.trim().length > 0) {
        return proxy.trim().replace(/\/$/, '')
    }
    const prod = import.meta.env.VITE_API_BASE_URL
    if (typeof prod === 'string' && prod.trim().length > 0) {
        return prod.trim().replace(/\/$/, '')
    }
    return 'http://localhost:8080'
}

/** True when `a` is strictly after `b` (both ISO instants); if `b` is null/undefined, any non-null `a` wins. */
function isValidatedAfter(a: string | null | undefined, b: string | null | undefined): boolean {
    if (a == null || a === '') return false
    if (b == null || b === '') return true
    return new Date(a).getTime() > new Date(b).getTime()
}

export function IntegrationPage() {
    const gameId = useGameId()
    const configurationHref = `/g/${encodeURIComponent(gameId)}/configuration`
    const sdkHref = `/g/${encodeURIComponent(gameId)}/sdk`

    const [ingestStatus, setIngestStatus] = useState<{ configured: boolean } | null>(null)

    const [baselineAt, setBaselineAt] = useState<string | null>(null)
    const [listening, setListening] = useState(false)
    const [successAt, setSuccessAt] = useState<string | null>(null)
    const [pollError, setPollError] = useState<string | null>(null)

    const suggestedBase = useMemo(() => getSuggestedApiBaseUrl(), [])

    useEffect(() => {
        let cancelled = false
        void (async () => {
            try {
                const tokenStatus = await getIngestTokenStatus(gameId)
                if (!cancelled) {
                    setIngestStatus({ configured: tokenStatus.configured })
                }
            } catch {
                if (!cancelled) setIngestStatus(null)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [gameId])

    const integrationPath = useMemo(() => `/api/games/${gameId}/integration`, [gameId])

    const startCheck = useCallback(() => {
        void (async () => {
            try {
                const s = await getIntegrationStatus(gameId)
                setBaselineAt(s.lastValidatedAt)
                setSuccessAt(null)
                setPollError(null)
                setListening(true)
            } catch {
                setPollError('Could not read integration status. Is the API running?')
            }
        })()
    }, [gameId])

    useEffect(() => {
        if (!listening || successAt != null) {
            return
        }

        const tick = () => {
            void (async () => {
                try {
                    const s = await getIntegrationStatus(gameId)
                    if (isValidatedAfter(s.lastValidatedAt, baselineAt)) {
                        setSuccessAt(s.lastValidatedAt ?? null)
                        setListening(false)
                        setPollError(null)
                    }
                } catch {
                    setPollError('Could not poll integration status.')
                }
            })()
        }

        tick()
        const handle = window.setInterval(tick, 2000)
        return () => window.clearInterval(handle)
    }, [listening, successAt, gameId, baselineAt])

    const panelState: 'idle' | 'waiting' | 'ok' = successAt != null ? 'ok' : listening ? 'waiting' : 'idle'

    return (
        <div className="gamePageStack">
            <header className="integrationPageHeader">
                <h1 className="integrationPageTitle">Godot integration</h1>
                <p className="integrationPageLead">
                    Validate that your game can reach GDTracker using the ingest token. Set up an SDK/addon first, then
                    come back here to confirm your ping was accepted.
                </p>
            </header>

            <section className="gamePageSection integrationSection">
                <div className="integrationSectionInner">
                    <h2 className="integrationSectionTitle">1) Set up an SDK/addon first</h2>
                    <p className="integrationProse">
                        Open{' '}
                        <Link className="appTextLink" to={sdkHref}>
                            SDK Integration
                        </Link>{' '}
                        and follow one of the guides (C# SDK, GDScript addon, or experimental GDExtension). Once your
                        game can call the integration ping, return here to validate it.
                    </p>
                    <ul className="integrationList">
                        <li>
                            You will call <code>POST {suggestedBase}{integrationPath}</code> with JSON body{' '}
                            <code>{VALIDATION_BODY_JSON}</code>.
                        </li>
                        <li>
                            <strong>Headers:</strong> <code>Content-Type: application/json</code> and{' '}
                            <code>Authorization: Bearer &lt;ingest-token&gt;</code>. No browser session, CSRF cookie, or{' '}
                            <code>X-Player-Id</code> is required for this route.
                        </li>
                        <li>
                            Other ingest routes (events, traces, exceptions, feedback) also require header{' '}
                            <code>X-Player-Id</code> after you register a player via <code>POST .../game-players</code>.
                            Ingest token setup lives under{' '}
                            <Link className="appTextLink" to={configurationHref}>
                                Configuration
                            </Link>
                            .
                        </li>
                    </ul>
                </div>
            </section>

            <section className="gamePageSection integrationSection">
                <div className="integrationSectionInner">
                    <h2 className="integrationSectionTitle">Ingest token</h2>
                    <ol className="integrationList ordered">
                        <li>
                            Open{' '}
                            <Link className="appTextLink" to={configurationHref}>
                                Configuration
                            </Link>{' '}
                            for this game.
                        </li>
                        <li>
                            In the <strong>Ingest token</strong> panel, ensure a token is configured (or use{' '}
                            <strong>Regenerate token</strong>).
                        </li>
                        <li>
                            Copy the plaintext token when it is shown and store it in your game. It is only displayed
                            once after regeneration.
                        </li>
                        <li>
                            Pass it as <code>Bearer &lt;token&gt;</code> on the request. Do not commit tokens to source
                            control.
                        </li>
                    </ol>
                    {ingestStatus && !ingestStatus.configured && (
                        <p className="integrationWarn">
                            No ingest token is configured yet. Set one up under Configuration before testing from Godot.
                        </p>
                    )}
                </div>
            </section>

            <section className="gamePageSection integrationSection">
                <div className="integrationSectionInner">
                    <h2 className="integrationSectionTitle">2) Trigger a ping from your game</h2>
                    <p className="integrationProse">
                        In your game, call the integration ping using the guide you chose on{' '}
                        <Link className="appTextLink" to={sdkHref}>
                            SDK Integration
                        </Link>
                        . Then use the panel below to confirm the server stored a new validation timestamp.
                    </p>
                    <ul className="integrationList">
                        <li>
                            <strong>C# SDK:</strong> call <code>PingIntegration</code>.
                        </li>
                        <li>
                            <strong>GDScript addon:</strong> call <code>ping_integration()</code>.
                        </li>
                        <li>
                            <strong>GDExtension:</strong> call <code>ping_integration()</code> (native; experimental).
                        </li>
                    </ul>
                </div>
            </section>

            <section className="gamePageSection integrationSection">
                <div className="integrationSectionInner">
                    <h2 className="integrationSectionTitle">Authorization check</h2>
                    <p className="integrationProse">
                        Click <strong>Start check</strong> to record the current last-validation time, then run the
                        integration ping from your game (via the SDK/addon). When the server accepts a new ping, this
                        panel turns green. Use <strong>Check again</strong> to reset and run another test.
                    </p>
                    <p className="integrationProse">
                        <button type="button" className="authSecondaryButton" onClick={() => void startCheck()}>
                            Start check
                        </button>{' '}
                        <button
                            type="button"
                            className="authSecondaryButton"
                            onClick={() => {
                                setListening(false)
                                setSuccessAt(null)
                                setBaselineAt(null)
                                setPollError(null)
                            }}
                        >
                            Check again
                        </button>
                    </p>

                    {pollError && <p className="integrationError">{pollError}</p>}

                    <div
                        className="integrationValidationPanel"
                        data-state={panelState}
                        role="status"
                        aria-live="polite"
                    >
                        {successAt != null ? (
                            <>
                                <span className="integrationValidationIcon integrationValidationCheck" aria-hidden>
                                    ✓
                                </span>
                                <div>
                                    <p className="integrationValidationTitle">Ingest authorized</p>
                                    <p className="integrationValidationDetail">
                                        Last validation at {successAt ? new Date(successAt).toLocaleString() : '—'}{' '}
                                        (server time).
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                {listening ? (
                                    <span className="integrationThrobber" aria-hidden />
                                ) : (
                                    <span className="integrationValidationIdleDot" aria-hidden />
                                )}
                                <div>
                                    <p className="integrationValidationTitle">
                                        {listening ? 'Waiting for ping…' : 'Idle — click Start check before you send'}
                                    </p>
                                    <p className="integrationValidationDetail">
                                        {listening
                                            ? 'Send POST .../integration from Godot with your ingest token.'
                                            : 'Start check captures the baseline so only a new ping counts.'}
                                    </p>
                                </div>
                            </>
                        )}
                    </div>

                    <ul className="integrationList integrationTroubleshoot">
                        <li>401 from the API: wrong or missing Bearer token, or token was rotated.</li>
                        <li>400 on POST: body must be exactly {VALIDATION_BODY_JSON}.</li>
                        <li>
                            If the panel never turns green: click Start check, then send the request; ensure the API
                            base URL and game id match this game.
                        </li>
                    </ul>
                </div>
            </section>
        </div>
    )
}
