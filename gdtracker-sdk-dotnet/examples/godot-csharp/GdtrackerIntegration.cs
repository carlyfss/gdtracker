using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Gdtracker;
using Godot;

/// <summary>
/// Copy-paste integration helpers: one method per ingest feature.
/// Replace BaseUrl, GameId, and IngestToken (or call <see cref="Configure"/> from a Node with [Export] fields).
/// Event parameter keys must match your game’s definitions in GDTracker.
/// </summary>
public static class GdtrackerIntegration
{
    private static GdtrackerClient? _client;

    private static GdtrackerClientOptions DefaultOptions() => new()
    {
        BaseUrl = "http://localhost:8080",
        GameId = "REPLACE_ME",
        IngestToken = "REPLACE_ME",
    };

    private static GdtrackerClient Client => _client ??= new GdtrackerClient(DefaultOptions());

    /// <summary>Point the integration helpers at your game (disposes any previous client).</summary>
    public static void Configure(GdtrackerClientOptions options)
    {
        _client?.Dispose();
        _client = new GdtrackerClient(options ?? throw new ArgumentNullException(nameof(options)));
    }

    private static string FormatVector3(Vector3 location) =>
        $"({location.X}, {location.Y}, {location.Z})";

    /// <summary>Optional: wrap ingest calls so <see cref="GdtrackerApiException"/> is logged instead of crashing.</summary>
    public static async Task SafeRun(Func<Task> action)
    {
        try
        {
            await action().ConfigureAwait(false);
        }
        catch (GdtrackerApiException ex)
        {
            GD.PushError($"GDTracker API error: {(int)ex.StatusCode} {ex.Message}\n{ex.ResponseBody}");
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
}
