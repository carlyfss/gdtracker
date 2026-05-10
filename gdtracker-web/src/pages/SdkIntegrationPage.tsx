import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGameId } from '../context/GameIdContext'

type SdkTab = 'overview' | 'csharp' | 'gdscript' | 'gdextension'

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

function escapeForGdscriptDoubleQuoted(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function escapeForCSharpQuoted(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function SdkIntegrationPage() {
    const gameId = useGameId()
    const configurationHref = `/g/${encodeURIComponent(gameId)}/configuration`
    const suggestedBase = useMemo(() => getSuggestedApiBaseUrl(), [])
    const [tab, setTab] = useState<SdkTab>('overview')
    const [copyFlash, setCopyFlash] = useState<string | null>(null)

    const overviewCsharpQuickstart = useMemo(() => {
        const base = escapeForCSharpQuoted(suggestedBase)
        const gid = escapeForCSharpQuoted(gameId)
        return `// Godot C# quickstart (uses gdtracker-sdk-dotnet/).
using System.Collections.Generic;
using Gdtracker;
using Godot;

public partial class GdtrackerSdkQuickstart : Node
{
    private readonly GdtrackerClient _client = new(new GdtrackerClientOptions
    {
        BaseUrl = "${base}",
        GameId = "${gid}",
        IngestToken = "YOUR_INGEST_TOKEN",
    });

    public override async void _Ready()
    {
        await _client.PingIntegration();
        await _client.RegisterPlayer();

        await _client.CreateEvent("player_died", new Dictionary<string, string>
        {
            { "player_id", "123" },
            { "enemy", "Zombie" },
            { "map", "proto-dungeon" },
            { "location", "(35, 22, 17)" },
        });

        await _client.CreateTrace(location: "(35, 22, 17)", map: "proto-dungeon");
    }
}`
    }, [suggestedBase, gameId])

    const overviewGdscriptQuickstart = useMemo(() => {
        const base = escapeForGdscriptDoubleQuoted(suggestedBase)
        const gid = escapeForGdscriptDoubleQuoted(gameId)
        return `# GDScript quickstart (uses godot-addon/gdtracker/).
extends Node

@onready var gdtracker := GDTrackerClient.new()

func _ready() -> void:
    gdtracker.api_base_url = "${base}"
    gdtracker.game_id = "${gid}"
    gdtracker.ingest_token = "YOUR_INGEST_TOKEN"

    await gdtracker.ping_integration()
    await gdtracker.register_player()

    await gdtracker.create_event("player_died", {
        "player_id": "123",
        "enemy": "Zombie",
        "map": "proto-dungeon",
        "location": "(35, 22, 17)",
    })

    await gdtracker.create_trace("(35, 22, 17)", "proto-dungeon")`
    }, [suggestedBase, gameId])

    const csharpFullExample = useMemo(() => {
        const base = escapeForCSharpQuoted(suggestedBase)
        const gid = escapeForCSharpQuoted(gameId)
        return `// Full C# example: ping, register, event, trace, exception, feedback.
// Build + reference steps are in gdtracker-sdk-dotnet/README.md.

using System.Collections.Generic;
using Gdtracker;
using Godot;

public partial class GdtrackerSdkFullExample : Node
{
    private readonly GdtrackerClient _client = new(new GdtrackerClientOptions
    {
        BaseUrl = "${base}",
        GameId = "${gid}",
        IngestToken = "YOUR_INGEST_TOKEN",
    });

    public override async void _Ready()
    {
        await _client.PingIntegration();
        var playerId = await _client.RegisterPlayer();
        GD.Print("GDTracker playerId: ", playerId);

        await _client.CreateEvent("player_died", new Dictionary<string, string>
        {
            { "player_id", "123" },
            { "enemy", "Zombie" },
            { "map", "proto-dungeon" },
            { "location", "(35, 22, 17)" },
        });

        await _client.CreateTrace(location: "(35, 22, 17)", map: "proto-dungeon");

        await _client.CreateException(
            errorMessage: "NullReferenceException",
            shortErrorMessage: "NRE",
            location: "(35, 22, 17)",
            map: "proto-dungeon",
            stackTrace: "at Player.Tick()\\n..."
        );

        await _client.CreateFeedback(
            title: "Great session",
            description: "Loved the new level.",
            meters: new Dictionary<string, int> { { "game_fun", 8 }, { "balance", 6 } }
        );
    }
}`
    }, [suggestedBase, gameId])

    const gdscriptFullExample = useMemo(() => {
        const base = escapeForGdscriptDoubleQuoted(suggestedBase)
        const gid = escapeForGdscriptDoubleQuoted(gameId)
        return `# Full GDScript example: ping, register, event, trace, exception, feedback.
# Setup steps are in godot-addon/gdtracker/README.md.

extends Node

@onready var gdtracker := GDTrackerClient.new()

func _ready() -> void:
    gdtracker.api_base_url = "${base}"
    gdtracker.game_id = "${gid}"
    gdtracker.ingest_token = "YOUR_INGEST_TOKEN"

    await gdtracker.ping_integration()
    var player_id := await gdtracker.register_player()
    print("GDTracker playerId: ", player_id)

    await gdtracker.create_event("player_died", {
        "player_id": "123",
        "enemy": "Zombie",
        "map": "proto-dungeon",
        "location": "(35, 22, 17)",
    })

    await gdtracker.create_trace("(35, 22, 17)", "proto-dungeon")

    await gdtracker.create_exception(
        "NullReferenceException",
        "NRE",
        "(35, 22, 17)",
        "proto-dungeon",
        "at Player.tick()\\n..."
    )

    await gdtracker.create_feedback("Great session", "Loved the new level.", {
        "game_fun": 8,
        "balance": 6,
    })`
    }, [suggestedBase, gameId])

    const gdextensionUsageSnippet = useMemo(() => {
        const base = escapeForGdscriptDoubleQuoted(suggestedBase)
        const gid = escapeForGdscriptDoubleQuoted(gameId)
        return `# GDExtension usage (experimental). Build steps are in gdtracker-gdextension/README.md.
extends Node

func _ready() -> void:
    var c := GDTrackerClient.new()
    c.api_base_url = "${base}"
    c.game_id = "${gid}"
    c.ingest_token = "YOUR_INGEST_TOKEN"

    var ok := c.ping_integration()
    print("Ping ok: ", ok)

    var player_id := c.register_player()
    print("playerId: ", player_id)`
    }, [suggestedBase, gameId])

    const flashCopy = (key: string) => {
        setCopyFlash(key)
        window.setTimeout(() => setCopyFlash(null), 1600)
    }

    const copyText = async (text: string, key: string) => {
        try {
            await navigator.clipboard.writeText(text)
            flashCopy(key)
        } catch {
            flashCopy('error')
        }
    }

    return (
        <div className="gamePageStack">
            <header className="integrationPageHeader">
                <h1 className="integrationPageTitle">SDK Integration</h1>
                <p className="integrationPageLead">
                    Integrate GDTracker ingest into your Godot game via a C# SDK (recommended for C# projects) or a
                    lightweight GDScript addon.
                </p>
            </header>

            <section className="gamePageSection integrationSection">
                <div className="integrationSectionInner">
                    <h2 className="integrationSectionTitle">Choose a guide</h2>
                    <div className="integrationLangToggle" role="tablist" aria-label="SDK integration tabs">
                        <button
                            type="button"
                            className="integrationLangButton"
                            data-active={tab === 'overview'}
                            onClick={() => setTab('overview')}
                            role="tab"
                            aria-selected={tab === 'overview'}
                        >
                            Overview
                        </button>
                        <button
                            type="button"
                            className="integrationLangButton"
                            data-active={tab === 'csharp'}
                            onClick={() => setTab('csharp')}
                            role="tab"
                            aria-selected={tab === 'csharp'}
                        >
                            C# SDK
                        </button>
                        <button
                            type="button"
                            className="integrationLangButton"
                            data-active={tab === 'gdscript'}
                            onClick={() => setTab('gdscript')}
                            role="tab"
                            aria-selected={tab === 'gdscript'}
                        >
                            GDScript addon
                        </button>
                        <button
                            type="button"
                            className="integrationLangButton"
                            data-active={tab === 'gdextension'}
                            onClick={() => setTab('gdextension')}
                            role="tab"
                            aria-selected={tab === 'gdextension'}
                        >
                            GDExtension
                        </button>
                    </div>
                </div>
            </section>

            <section className="gamePageSection integrationSection">
                <div className="integrationSectionInner">
                    <h2 className="integrationSectionTitle">Configuration required</h2>
                    <ul className="integrationList">
                        <li>
                            <strong>Ingest token:</strong> set (or regenerate) it under{' '}
                            <Link className="appTextLink" to={configurationHref}>
                                Configuration
                            </Link>
                            . Your game sends it as <code>Authorization: Bearer &lt;token&gt;</code>.
                        </li>
                        <li>
                            <strong>Player id:</strong> call <code>POST .../game-players</code> once per session. The
                            response <code>playerId</code> must be sent on ingest calls as header{' '}
                            <code>X-Player-Id</code>.
                        </li>
                    </ul>
                </div>
            </section>

            {tab === 'overview' && (
                <section className="gamePageSection integrationSection">
                    <div className="integrationSectionInner">
                        <h2 className="integrationSectionTitle">Quickstart snippets</h2>
                        <p className="integrationProse">
                            Prefilled with the current <code>gameId</code> and an API base guess (
                            <code>{suggestedBase}</code>).
                        </p>

                        <div className="integrationCodeBlockWrap">
                            <div className="integrationCodeToolbar">
                                <span className="integrationCodeHint">C# quickstart</span>
                                <button
                                    type="button"
                                    className="authSecondaryButton integrationCopyBtn"
                                    onClick={() => void copyText(overviewCsharpQuickstart, 'overview-csharp')}
                                >
                                    {copyFlash === 'overview-csharp' ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            <pre className="integrationCodePre">
                                <code>{overviewCsharpQuickstart}</code>
                            </pre>
                        </div>

                        <div className="integrationCodeBlockWrap">
                            <div className="integrationCodeToolbar">
                                <span className="integrationCodeHint">GDScript quickstart</span>
                                <button
                                    type="button"
                                    className="authSecondaryButton integrationCopyBtn"
                                    onClick={() => void copyText(overviewGdscriptQuickstart, 'overview-gdscript')}
                                >
                                    {copyFlash === 'overview-gdscript' ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            <pre className="integrationCodePre">
                                <code>{overviewGdscriptQuickstart}</code>
                            </pre>
                        </div>

                        <ul className="integrationList integrationTroubleshoot">
                            <li>401: wrong/missing Bearer token (or token rotated).</li>
                            <li>
                                401 on ingest routes: missing/invalid <code>X-Player-Id</code> (call register first).
                            </li>
                            <li>Network errors: check your API host/port and CORS / firewall rules.</li>
                        </ul>
                    </div>
                </section>
            )}

            {tab === 'csharp' && (
                <section className="gamePageSection integrationSection">
                    <div className="integrationSectionInner">
                        <h2 className="integrationSectionTitle">C# SDK (gdtracker-sdk-dotnet)</h2>
                        <ol className="integrationList ordered">
                            <li>
                                Build the SDK from <code>gdtracker-sdk-dotnet/</code> (see README).
                            </li>
                            <li>
                                Reference <code>src/GdtrackerSdk/GdtrackerSdk.csproj</code> from your Godot C# solution
                                (Project Reference).
                            </li>
                            <li>
                                Use the client methods: <code>PingIntegration</code>, <code>RegisterPlayer</code>,{' '}
                                <code>CreateEvent</code>, <code>CreateTrace</code>, <code>CreateException</code>,{' '}
                                <code>CreateFeedback</code>.
                            </li>
                        </ol>

                        <div className="integrationCodeBlockWrap">
                            <div className="integrationCodeToolbar">
                                <span className="integrationCodeHint">Full example (all actions)</span>
                                <button
                                    type="button"
                                    className="authSecondaryButton integrationCopyBtn"
                                    onClick={() => void copyText(csharpFullExample, 'csharp-full')}
                                >
                                    {copyFlash === 'csharp-full' ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            <pre className="integrationCodePre">
                                <code>{csharpFullExample}</code>
                            </pre>
                        </div>
                    </div>
                </section>
            )}

            {tab === 'gdscript' && (
                <section className="gamePageSection integrationSection">
                    <div className="integrationSectionInner">
                        <h2 className="integrationSectionTitle">GDScript addon (godot-addon/gdtracker)</h2>
                        <ol className="integrationList ordered">
                            <li>
                                Copy <code>godot-addon/gdtracker/</code> into your Godot project at{' '}
                                <code>res://addons/gdtracker/</code>.
                            </li>
                            <li>
                                Instantiate <code>GDTrackerClient</code> (or add it as an Autoload).
                            </li>
                            <li>
                                Call <code>ping_integration()</code>, then <code>register_player()</code>, then the
                                create methods: <code>create_event</code>, <code>create_trace</code>,{' '}
                                <code>create_exception</code>, <code>create_feedback</code>.
                            </li>
                        </ol>

                        <div className="integrationCodeBlockWrap">
                            <div className="integrationCodeToolbar">
                                <span className="integrationCodeHint">Full example (all actions)</span>
                                <button
                                    type="button"
                                    className="authSecondaryButton integrationCopyBtn"
                                    onClick={() => void copyText(gdscriptFullExample, 'gdscript-full')}
                                >
                                    {copyFlash === 'gdscript-full' ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            <pre className="integrationCodePre">
                                <code>{gdscriptFullExample}</code>
                            </pre>
                        </div>
                    </div>
                </section>
            )}

            {tab === 'gdextension' && (
                <section className="gamePageSection integrationSection">
                    <div className="integrationSectionInner">
                        <h2 className="integrationSectionTitle">GDExtension (experimental)</h2>
                        <p className="integrationProse">
                            This repo includes a native extension skeleton under <code>gdtracker-gdextension/</code>.
                            You must provide <code>godot-cpp</code> and build per-platform binaries yourself. See{' '}
                            <code>gdtracker-gdextension/README.md</code>.
                        </p>

                        <div className="integrationCodeBlockWrap">
                            <div className="integrationCodeToolbar">
                                <span className="integrationCodeHint">Usage snippet</span>
                                <button
                                    type="button"
                                    className="authSecondaryButton integrationCopyBtn"
                                    onClick={() => void copyText(gdextensionUsageSnippet, 'gdext-snippet')}
                                >
                                    {copyFlash === 'gdext-snippet' ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            <pre className="integrationCodePre">
                                <code>{gdextensionUsageSnippet}</code>
                            </pre>
                        </div>
                    </div>
                </section>
            )}
        </div>
    )
}
