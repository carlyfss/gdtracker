import { useCallback, useEffect, useState } from 'react'
import { getIngestTokenStatus, regenerateIngestToken } from '../../../api/gameEvents'

const INGEST_TOKEN_SECTION_SUBTITLE =
    'Authenticates your game client for posting events without a browser session or CSRF token.'

export function GameIngestTokenSection({ gameId }: { gameId: string }) {
    const [ingestConfigured, setIngestConfigured] = useState(false)
    const [ingestCreatedAt, setIngestCreatedAt] = useState<string | null>(null)
    const [lastRevealedIngestToken, setLastRevealedIngestToken] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [banner, setBanner] = useState<{ kind: 'error' | 'success'; message: string } | null>(null)

    const load = useCallback(async () => {
        setBanner(null)
        try {
            const tok = await getIngestTokenStatus(gameId)
            setIngestConfigured(!!tok.configured)
            setIngestCreatedAt(tok.createdAt ?? null)
        } catch {
            setBanner({ kind: 'error', message: 'Failed to load ingest token status.' })
        }
    }, [gameId])

    useEffect(() => {
        const t = window.setTimeout(() => void load(), 0)
        return () => window.clearTimeout(t)
    }, [load])

    const onRegenerateToken = async () => {
        const ok = window.confirm(
            'Regenerate the ingest token? The old token will stop working immediately. Copy the new value now; it is only shown once.'
        )
        if (!ok) return
        setBusy(true)
        setBanner(null)
        try {
            const res = await regenerateIngestToken(gameId)
            setIngestConfigured(true)
            setIngestCreatedAt(res.createdAt ?? null)
            setLastRevealedIngestToken(res.token)
            setBanner({ kind: 'success', message: 'New token generated. Store it in a safe place.' })
            await navigator.clipboard.writeText(res.token)
        } catch {
            setBanner({ kind: 'error', message: 'Failed to regenerate ingest token.' })
        } finally {
            setBusy(false)
        }
    }

    const onCopyRevealedToken = async () => {
        if (!lastRevealedIngestToken) return
        try {
            await navigator.clipboard.writeText(lastRevealedIngestToken)
        } catch {
            /* ignore */
        }
    }

    return (
        <div className="gameEventsSubPanel" style={{ marginBottom: 24 }}>
            <h3 className="gameEventsSectionPanelTitle">Ingest token</h3>
            <p className="gameEventsSectionSubtitle">{INGEST_TOKEN_SECTION_SUBTITLE}</p>
            {banner && (
                <div
                    className={banner.kind === 'error' ? 'banner bannerError' : 'banner bannerSuccess'}
                    style={{ marginBottom: 10 }}
                >
                    {banner.message}
                </div>
            )}
            <p style={{ margin: '0 0 10px', opacity: 0.85, fontSize: 13 }}>
                The game client sends <code style={{ fontSize: 12 }}>Authorization: Bearer &lt;token&gt;</code> on{' '}
                <code style={{ fontSize: 12 }}>POST /api/games/&#123;gameId&#125;/game-events/ingest</code>. CSRF is not
                required for that endpoint.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 13 }}>
                    Status: <strong>{ingestConfigured ? 'configured' : 'not set'}</strong>
                    {ingestCreatedAt && (
                        <span style={{ opacity: 0.75, marginLeft: 8 }}>
                            (last created {new Date(ingestCreatedAt).toLocaleString()})
                        </span>
                    )}
                </span>
                <button
                    type="button"
                    className="btn btnPrimary"
                    disabled={busy}
                    onClick={() => void onRegenerateToken()}
                >
                    Regenerate token
                </button>
            </div>
            {lastRevealedIngestToken && (
                <div className="ingestTokenReveal">
                    <span className="ingestTokenRevealLabel">
                        Current token (shown until you leave or refresh this page — store it securely):
                    </span>
                    <code className="ingestTokenRevealValue">{lastRevealedIngestToken}</code>
                    <div className="ingestTokenRevealActions">
                        <button type="button" className="btn" onClick={() => void onCopyRevealedToken()}>
                            Copy token
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
