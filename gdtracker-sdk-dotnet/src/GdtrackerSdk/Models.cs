using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace Gdtracker;

public sealed record GamePlayerRegisterResponse
{
    [JsonPropertyName("playerId")]
    public string PlayerId { get; init; } = "";
}

public sealed record IntegrationPingRequest
{
    [JsonPropertyName("validation")]
    public string Validation { get; init; } = "ok";
}

public sealed record GameEventIngestRequest
{
    [JsonPropertyName("definitionCode")]
    public string DefinitionCode { get; init; } = "";

    [JsonPropertyName("parameters")]
    public Dictionary<string, string>? Parameters { get; init; }
}

public sealed record GameEventTraceCreateRequest
{
    [JsonPropertyName("location")]
    public string? Location { get; init; }

    [JsonPropertyName("map")]
    public string? Map { get; init; }

    [JsonPropertyName("gameEventId")]
    public string? GameEventId { get; init; }
}

public sealed record GameExceptionIngestRequest
{
    [JsonPropertyName("errorMessage")]
    public string? ErrorMessage { get; init; }

    [JsonPropertyName("shortErrorMessage")]
    public string? ShortErrorMessage { get; init; }

    [JsonPropertyName("location")]
    public string? Location { get; init; }

    [JsonPropertyName("map")]
    public string? Map { get; init; }

    [JsonPropertyName("stackTrace")]
    public string? StackTrace { get; init; }
}

public sealed record GameFeedbackIngestRequest
{
    [JsonPropertyName("title")]
    public string Title { get; init; } = "";

    [JsonPropertyName("description")]
    public string Description { get; init; } = "";

    [JsonPropertyName("meters")]
    public Dictionary<string, int>? Meters { get; init; }
}

