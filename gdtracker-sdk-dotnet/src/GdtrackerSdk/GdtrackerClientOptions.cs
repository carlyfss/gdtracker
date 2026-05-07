using System;

namespace Gdtracker;

public sealed record GdtrackerClientOptions
{
    public required string BaseUrl { get; init; }
    public required string GameId { get; init; }
    public required string IngestToken { get; init; }

    /// <summary>
    /// Optional. If not set, call RegisterPlayer() and it will be stored here.
    /// </summary>
    public string? PlayerId { get; set; }

    public Uri GetBaseUri()
    {
        var trimmed = BaseUrl.Trim();
        if (trimmed.Length == 0)
        {
            throw new ArgumentException("BaseUrl is required.", nameof(BaseUrl));
        }

        // Allow callers to pass host:port without scheme.
        if (!trimmed.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            && !trimmed.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = $"http://{trimmed}";
        }

        return new Uri(trimmed.TrimEnd('/'), UriKind.Absolute);
    }
}

