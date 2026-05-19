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
        return `// Godot C# quickstart (gdtracker-sdk-dotnet). Full template:
// gdtracker-sdk-dotnet/examples/godot-csharp/GdtrackerIntegration.cs
using System.Collections.Generic;
using System.Threading.Tasks;
using Gdtracker;

public static class GdtrackerIntegration
{
    private static GdtrackerClient? _client;

    private static GdtrackerClient Client =>
        _client ??= new GdtrackerClient(new GdtrackerClientOptions
        {
            BaseUrl = "${base}",
            GameId = "${gid}",
            IngestToken = "YOUR_INGEST_TOKEN",
        });

    public static Task PingIntegration() => Client.PingIntegration();

    public static Task<string> RegisterPlayer() => Client.RegisterPlayer();

    public static Task CreateExampleEvent() =>
        Client.CreateEvent("player_died", new Dictionary<string, string>
        {
            { "player_id", "123" },
            { "enemy", "Zombie" },
            { "map", "proto-dungeon" },
            { "location", "(35, 22, 17)" },
        });

    public static Task CreateExampleTrace() =>
        Client.CreateTrace(location: "(35, 22, 17)", map: "proto-dungeon");
}`
    }, [suggestedBase, gameId])

    const overviewGdscriptQuickstart = useMemo(() => {
        const base = escapeForGdscriptDoubleQuoted(suggestedBase)
        const gid = escapeForGdscriptDoubleQuoted(gameId)
        return `# GDScript quickstart (godot-addon/gdtracker). Full per-feature example:
# godot-addon/gdtracker/examples/gdscript_integration_example.gd
extends Node

var _client := GDTrackerClient.new()

func _ready() -> void:
    _client.api_base_url = "${base}"
    _client.game_id = "${gid}"
    _client.ingest_token = "YOUR_INGEST_TOKEN"
    await example_ping_integration()

func example_ping_integration() -> void:
    await _client.ping_integration()

func example_register_player() -> void:
    var player_id := await _client.register_player()
    print("GDTracker playerId: ", player_id)`
    }, [suggestedBase, gameId])

    const csharpFullExample = useMemo(() => {
        const base = escapeForCSharpQuoted(suggestedBase)
        const gid = escapeForCSharpQuoted(gameId)
        return `// Full C# per-feature integration (repo: examples/godot-csharp/GdtrackerIntegration.cs).
// Build + ProjectReference steps: gdtracker-sdk-dotnet/README.md
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Gdtracker;
using Godot;

public static class GdtrackerIntegration
{
    private static GdtrackerClient? _client;

    private static GdtrackerClientOptions DefaultOptions() => new()
    {
        BaseUrl = "${base}",
        GameId = "${gid}",
        IngestToken = "YOUR_INGEST_TOKEN",
    };

    private static GdtrackerClient Client => _client ??= new GdtrackerClient(DefaultOptions());

    public static void Configure(GdtrackerClientOptions options)
    {
        _client?.Dispose();
        _client = new GdtrackerClient(options ?? throw new ArgumentNullException(nameof(options)));
    }

    private static string FormatVector3(Vector3 location) =>
        "(" + location.X + ", " + location.Y + ", " + location.Z + ")";

    public static async Task SafeRun(Func<Task> action)
    {
        try
        {
            await action().ConfigureAwait(false);
        }
        catch (GdtrackerApiException ex)
        {
            GD.PushError(
                "GDTracker API error: " + ((int)ex.StatusCode).ToString() + " " + ex.Message + "\\n" + (ex.ResponseBody ?? "")
            );
        }
    }

    public static Task PingIntegration(CancellationToken ct = default) => Client.PingIntegration(ct);

    public static Task<string> RegisterPlayer(CancellationToken ct = default) => Client.RegisterPlayer(ct);

    public static Task CreateEvent(
        string eventId,
        string playerId,
        string key,
        string? value,
        string map,
        Vector3 location,
        CancellationToken ct = default)
    {
        return Client.CreateEvent(
            eventId,
            new Dictionary<string, string>
            {
                { "playerId", playerId },
                { "key", key },
                { "value", value ?? "" },
                { "map", map },
                { "location", FormatVector3(location) },
            },
            ct);
    }

    public static Task CreateTrace(string map, Vector3 location, CancellationToken ct = default) =>
        Client.CreateTrace(location: FormatVector3(location), map: map, gameEventId: null, ct);

    public static Task CreateException(
        string? errorMessage,
        string? shortErrorMessage = null,
        string? location = null,
        string? map = null,
        string? stackTrace = null,
        CancellationToken ct = default) =>
        Client.CreateException(errorMessage, shortErrorMessage, location, map, stackTrace, ct);

    public static Task CreateFeedback(
        string title,
        string description,
        Dictionary<string, int>? meters = null,
        CancellationToken ct = default) =>
        Client.CreateFeedback(title, description, meters, ct);
}`
    }, [suggestedBase, gameId])

    const gdscriptFullExample = useMemo(() => {
        const base = escapeForGdscriptDoubleQuoted(suggestedBase)
        const gid = escapeForGdscriptDoubleQuoted(gameId)
        return `# Full GDScript per-feature example (repo: examples/gdscript_integration_example.gd).
# Setup: godot-addon/gdtracker/README.md
extends Node

var _client := GDTrackerClient.new()

func _ready() -> void:
    _configure_client()

func _configure_client() -> void:
    _client.api_base_url = "${base}"
    _client.game_id = "${gid}"
    _client.ingest_token = "YOUR_INGEST_TOKEN"

func format_vector3(location: Vector3) -> String:
    return "(%s, %s, %s)" % [location.x, location.y, location.z]

func example_ping_integration() -> void:
    await _client.ping_integration()

func example_register_player() -> void:
    var player_id := await _client.register_player()
    print("GDTracker playerId: ", player_id)

func example_create_event(
    event_id: String,
    player_id: String,
    key: String,
    value: String,
    map_name: String,
    location: Vector3,
) -> void:
    await _client.create_event(event_id, {
        "playerId": player_id,
        "key": key,
        "value": value,
        "map": map_name,
        "location": format_vector3(location),
    })

func example_create_trace(map_name: String, location: Vector3) -> void:
    await _client.create_trace(format_vector3(location), map_name)

func example_create_exception() -> void:
    await _client.create_exception(
        "NullReferenceException",
        "NRE",
        "(35, 22, 17)",
        "proto-dungeon",
        "at Player.tick()\\n...",
    )

func example_create_feedback() -> void:
    await _client.create_feedback("Great session", "Loved the new level.", {
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
                                <code>CreateFeedback</code>. Copy the per-feature template from{' '}
                                <code>examples/godot-csharp/GdtrackerIntegration.cs</code>.
                            </li>
                        </ol>

                        <div className="integrationCodeBlockWrap">
                            <div className="integrationCodeToolbar">
                                <span className="integrationCodeHint">Full per-feature integration (C#)</span>
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
                                <code>create_exception</code>, <code>create_feedback</code>. Per-feature template:{' '}
                                <code>examples/gdscript_integration_example.gd</code>.
                            </li>
                        </ol>

                        <div className="integrationCodeBlockWrap">
                            <div className="integrationCodeToolbar">
                                <span className="integrationCodeHint">Full per-feature integration (GDScript)</span>
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
