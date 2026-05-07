using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Gdtracker;

public sealed class GdtrackerClient : IDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

    private readonly HttpClient _http;
    private readonly bool _disposeHttpClient;
    private readonly GdtrackerClientOptions _options;

    public GdtrackerClient(GdtrackerClientOptions options, HttpClient? httpClient = null)
    {
        _options = options ?? throw new ArgumentNullException(nameof(options));

        _http = httpClient ?? new HttpClient();
        _disposeHttpClient = httpClient == null;

        _http.Timeout = TimeSpan.FromSeconds(10);
    }

    public string? PlayerId => _options.PlayerId;

    public async Task<string> RegisterPlayer(CancellationToken ct = default)
    {
        var path = $"/api/games/{Uri.EscapeDataString(_options.GameId)}/game-players";
        var req = CreateRequest(HttpMethod.Post, path, includePlayerId: false);

        using var res = await _http.SendAsync(req, ct).ConfigureAwait(false);
        var body = await ReadBodyAsync(res, ct).ConfigureAwait(false);
        EnsureSuccessOrThrow(res, body);

        var parsed = JsonSerializer.Deserialize<GamePlayerRegisterResponse>(body, JsonOptions);
        if (parsed?.PlayerId == null || parsed.PlayerId.Trim().Length == 0)
        {
            throw new GdtrackerApiException("Register player returned an empty playerId.", res.StatusCode, body);
        }

        _options.PlayerId = parsed.PlayerId.Trim();
        return _options.PlayerId;
    }

    public async Task PingIntegration(CancellationToken ct = default)
    {
        var path = $"/api/games/{Uri.EscapeDataString(_options.GameId)}/integration";
        var reqBody = new IntegrationPingRequest { Validation = "ok" };

        var req = CreateRequest(HttpMethod.Post, path, includePlayerId: false);
        req.Content = ToJsonContent(reqBody);

        using var res = await _http.SendAsync(req, ct).ConfigureAwait(false);
        var body = await ReadBodyAsync(res, ct).ConfigureAwait(false);
        EnsureSuccessOrThrow(res, body);
    }

    public async Task CreateEvent(string definitionCode, Dictionary<string, string>? parameters = null, CancellationToken ct = default)
    {
        RequirePlayerId();

        var path = $"/api/games/{Uri.EscapeDataString(_options.GameId)}/game-events/ingest";
        var reqBody = new GameEventIngestRequest { DefinitionCode = definitionCode ?? "", Parameters = parameters };

        var req = CreateRequest(HttpMethod.Post, path, includePlayerId: true);
        req.Content = ToJsonContent(reqBody);

        using var res = await _http.SendAsync(req, ct).ConfigureAwait(false);
        var body = await ReadBodyAsync(res, ct).ConfigureAwait(false);
        EnsureSuccessOrThrow(res, body);
    }

    public async Task CreateTrace(string? location, string? map, string? gameEventId = null, CancellationToken ct = default)
    {
        RequirePlayerId();

        var path = $"/api/games/{Uri.EscapeDataString(_options.GameId)}/game-trace/ingest";
        var reqBody = new GameEventTraceCreateRequest { Location = location, Map = map, GameEventId = gameEventId };

        var req = CreateRequest(HttpMethod.Post, path, includePlayerId: true);
        req.Content = ToJsonContent(reqBody);

        using var res = await _http.SendAsync(req, ct).ConfigureAwait(false);
        var body = await ReadBodyAsync(res, ct).ConfigureAwait(false);
        EnsureSuccessOrThrow(res, body);
    }

    public async Task CreateException(
        string? errorMessage,
        string? shortErrorMessage = null,
        string? location = null,
        string? map = null,
        string? stackTrace = null,
        CancellationToken ct = default)
    {
        RequirePlayerId();

        var path = $"/api/games/{Uri.EscapeDataString(_options.GameId)}/game-exceptions/ingest";
        var reqBody = new GameExceptionIngestRequest
        {
            ErrorMessage = errorMessage,
            ShortErrorMessage = shortErrorMessage,
            Location = location,
            Map = map,
            StackTrace = stackTrace,
        };

        var req = CreateRequest(HttpMethod.Post, path, includePlayerId: true);
        req.Content = ToJsonContent(reqBody);

        using var res = await _http.SendAsync(req, ct).ConfigureAwait(false);
        var body = await ReadBodyAsync(res, ct).ConfigureAwait(false);
        EnsureSuccessOrThrow(res, body);
    }

    public async Task CreateFeedback(
        string title,
        string description,
        Dictionary<string, int>? meters = null,
        CancellationToken ct = default)
    {
        RequirePlayerId();

        var path = $"/api/games/{Uri.EscapeDataString(_options.GameId)}/game-feedback/ingest";
        var reqBody = new GameFeedbackIngestRequest { Title = title ?? "", Description = description ?? "", Meters = meters };

        var req = CreateRequest(HttpMethod.Post, path, includePlayerId: true);
        req.Content = ToJsonContent(reqBody);

        using var res = await _http.SendAsync(req, ct).ConfigureAwait(false);
        var body = await ReadBodyAsync(res, ct).ConfigureAwait(false);
        EnsureSuccessOrThrow(res, body);
    }

    private void RequirePlayerId()
    {
        var pid = _options.PlayerId;
        if (pid == null || pid.Trim().Length == 0)
        {
            throw new InvalidOperationException("PlayerId is not set. Call RegisterPlayer() first.");
        }
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string path, bool includePlayerId)
    {
        var baseUri = _options.GetBaseUri();
        var uri = new Uri(baseUri, path);

        var req = new HttpRequestMessage(method, uri);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.IngestToken);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        if (includePlayerId && _options.PlayerId != null)
        {
            req.Headers.TryAddWithoutValidation("X-Player-Id", _options.PlayerId);
        }

        return req;
    }

    private static HttpContent ToJsonContent<T>(T payload)
    {
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        return new StringContent(json, Encoding.UTF8, "application/json");
    }

    private static async Task<string> ReadBodyAsync(HttpResponseMessage res, CancellationToken ct)
    {
        if (res.Content == null)
        {
            return "";
        }

        return await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
    }

    private static void EnsureSuccessOrThrow(HttpResponseMessage res, string body)
    {
        if ((int)res.StatusCode >= 200 && (int)res.StatusCode < 300)
        {
            return;
        }

        var msg = $"GDTracker API error {(int)res.StatusCode} {res.ReasonPhrase}";
        throw new GdtrackerApiException(msg, res.StatusCode, body);
    }

    public void Dispose()
    {
        if (_disposeHttpClient)
        {
            _http.Dispose();
        }
    }
}

