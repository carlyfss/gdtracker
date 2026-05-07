import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getIngestTokenStatus } from '../api/gameEvents'
import { getIntegrationStatus } from '../api/integration'
import { useGameId } from '../context/GameIdContext'

type CodeLang = 'gdscript' | 'csharp'

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

function parseHttpHostPort(base: string): { host: string; port: number } {
    try {
        const normalized = /^https?:\/\//i.test(base) ? base : `http://${base}`
        const u = new URL(normalized)
        const port = u.port ? parseInt(u.port, 10) : u.protocol === 'https:' ? 443 : 80
        return { host: u.hostname, port }
    } catch {
        return { host: 'localhost', port: 8080 }
    }
}

function escapeForGdscriptDoubleQuoted(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function escapeForCSharpQuoted(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
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

    const [ingestStatus, setIngestStatus] = useState<{ configured: boolean } | null>(null)
    const [codeLang, setCodeLang] = useState<CodeLang>('gdscript')
    const [copyFlash, setCopyFlash] = useState<string | null>(null)

    const [baselineAt, setBaselineAt] = useState<string | null>(null)
    const [listening, setListening] = useState(false)
    const [successAt, setSuccessAt] = useState<string | null>(null)
    const [pollError, setPollError] = useState<string | null>(null)

    const suggestedBase = useMemo(() => getSuggestedApiBaseUrl(), [])
    const { host: apiHost, port: apiPort } = useMemo(() => parseHttpHostPort(suggestedBase), [suggestedBase])

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

    const csharpExample = useMemo(() => {
        const bodyEscaped = escapeForCSharpQuoted(VALIDATION_BODY_JSON)
        return `using Godot;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;

// Replace INGEST_TOKEN with your token from Configuration → Ingest token.
public static class GdtrackerIntegrationExample
{
    private const string Host = "${apiHost}";
    private const int Port = ${apiPort};
    private static string IntegrationPath => @"${integrationPath}";
    private const string IngestToken = "YOUR_INGEST_TOKEN";

    public static async Task<string?> PostIntegrationPing(string jsonBody)
    {
        string[] headers = { "Content-Type: application/json", $"Authorization: Bearer {IngestToken}" };
        var http = new HttpClient();
        if (http.ConnectToHost(Host, Port) != Error.Ok)
            return null;

        while (http.GetStatus() is HttpClient.Status.Connecting or HttpClient.Status.Resolving)
        {
            http.Poll();
            await Task.Delay(200);
        }

        if (http.GetStatus() != HttpClient.Status.Connected)
            return null;

        if (http.Request(HttpClient.Method.Post, IntegrationPath, headers, jsonBody) != Error.Ok)
            return null;

        while (!http.HasResponse())
        {
            http.Poll();
            await Task.Delay(200);
        }

        var responseBytes = new List<byte>();
        if (http.IsResponseChunked())
        {
            while (true)
            {
                http.Poll();
                var chunk = http.ReadResponseBodyChunk();
                if (chunk.Length == 0)
                {
                    if (responseBytes.Count > 0)
                        break;
                    await Task.Delay(100);
                    continue;
                }
                responseBytes.AddRange(chunk);
            }
        }

        http.Close();
        return Encoding.UTF8.GetString(responseBytes.ToArray());
    }

    // Example: await PostIntegrationPing("${bodyEscaped}");
}
`
    }, [apiHost, apiPort, integrationPath])

    const gdscriptExample = useMemo(() => {
        const base = escapeForGdscriptDoubleQuoted(suggestedBase)
        const gid = escapeForGdscriptDoubleQuoted(gameId)
        const bodyEsc = escapeForGdscriptDoubleQuoted(VALIDATION_BODY_JSON)
        return `extends Node

const _API_BASE := "${base}"
const _GAME_ID := "${gid}"
const _INGEST_TOKEN := "YOUR_INGEST_TOKEN"

func post_integration_ping(json_body: String) -> void:
    var http := HTTPRequest.new()
    add_child(http)
    var url := "%s/api/games/%s/integration" % [_API_BASE, _GAME_ID]
    var headers := PackedStringArray([
        "Content-Type: application/json",
        "Authorization: Bearer %s" % _INGEST_TOKEN,
    ])
    var err := http.request(url, headers, HTTPClient.METHOD_POST, json_body)
    if err != OK:
        push_error("GDTracker integration request failed: %s" % err)
        http.queue_free()
        return
    var result = await http.request_completed
    http.queue_free()
    var code = result[1] as int
    if code >= 200 and code < 300:
        print("GDTracker integration OK: ", code)
    else:
        push_warning("GDTracker integration HTTP %s" % str(code))

func run_example() -> void:
    await post_integration_ping("${bodyEsc}")
`
    }, [suggestedBase, gameId])

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

    const flashCopy = useCallback((key: string) => {
        setCopyFlash(key)
        window.setTimeout(() => setCopyFlash(null), 1600)
    }, [])

    const copyText = useCallback(
        async (text: string, key: string) => {
            try {
                await navigator.clipboard.writeText(text)
                flashCopy(key)
            } catch {
                flashCopy('error')
            }
        },
        [flashCopy]
    )

    const codeToShow = codeLang === 'csharp' ? csharpExample : gdscriptExample
    const panelState: 'idle' | 'waiting' | 'ok' = successAt != null ? 'ok' : listening ? 'waiting' : 'idle'

    return (
        <div className="gamePageStack">
            <header className="integrationPageHeader">
                <h1 className="integrationPageTitle">Godot integration</h1>
                <p className="integrationPageLead">
                    Verify your ingest token by posting to the integration endpoint from Godot, then confirm below that
                    the API accepted the request.
                </p>
            </header>

            <section className="gamePageSection integrationSection">
                <div className="integrationSectionInner">
                    <h2 className="integrationSectionTitle">What to send</h2>
                    <p className="integrationProse">
                        Use <code>POST {suggestedBase}/api/games/&lt;gameId&gt;/integration</code> with JSON body{' '}
                        <code>{VALIDATION_BODY_JSON}</code> (use your real API host and port).
                    </p>
                    <ul className="integrationList">
                        <li>
                            <strong>Headers:</strong> <code>Content-Type: application/json</code> and{' '}
                            <code>Authorization: Bearer &lt;ingest-token&gt;</code>. No browser session, CSRF cookie, or{' '}
                            <code>X-Player-Id</code> is required for this route.
                        </li>
                        <li>
                            Other ingest routes (events, traces, exceptions, feedback) also require header{' '}
                            <code>X-Player-Id</code> after you register a player via <code>POST .../game-players</code>.
                            Configure definitions and tokens under{' '}
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
                    <h2 className="integrationSectionTitle">Example client code</h2>
                    <p className="integrationProse">
                        The snippets POST to <code>{integrationPath}</code> with the fixed body above.
                    </p>
                    <div className="integrationLangToggle" role="group" aria-label="Code language">
                        <button
                            type="button"
                            className="integrationLangButton"
                            data-active={codeLang === 'gdscript'}
                            onClick={() => setCodeLang('gdscript')}
                        >
                            GDScript
                        </button>
                        <button
                            type="button"
                            className="integrationLangButton"
                            data-active={codeLang === 'csharp'}
                            onClick={() => setCodeLang('csharp')}
                        >
                            C#
                        </button>
                    </div>
                    <div className="integrationCodeBlockWrap">
                        <div className="integrationCodeToolbar">
                            <span className="integrationCodeHint">Copy into your Godot project</span>
                            <button
                                type="button"
                                className="authSecondaryButton integrationCopyBtn"
                                onClick={() => void copyText(codeToShow, 'code')}
                            >
                                {copyFlash === 'code' ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                        <pre className="integrationCodePre">
                            <code>{codeToShow}</code>
                        </pre>
                    </div>
                    <div className="integrationCodeBlockWrap">
                        <div className="integrationCodeToolbar">
                            <span className="integrationCodeHint">Request body (JSON)</span>
                            <button
                                type="button"
                                className="authSecondaryButton integrationCopyBtn"
                                onClick={() => void copyText(VALIDATION_BODY_JSON, 'json')}
                            >
                                {copyFlash === 'json' ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                        <pre className="integrationCodePre">
                            <code>{VALIDATION_BODY_JSON}</code>
                        </pre>
                    </div>
                </div>
            </section>

            <section className="gamePageSection integrationSection">
                <div className="integrationSectionInner">
                    <h2 className="integrationSectionTitle">Authorization check</h2>
                    <p className="integrationProse">
                        Click <strong>Start check</strong> to record the current last-validation time, then run the
                        example from your game (or any HTTP client). When the server accepts a new ping, this panel
                        turns green. Use <strong>Check again</strong> to reset and run another test.
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
