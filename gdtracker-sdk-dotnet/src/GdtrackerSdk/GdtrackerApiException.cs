using System;
using System.Net;

namespace Gdtracker;

public sealed class GdtrackerApiException : Exception
{
    public HttpStatusCode StatusCode { get; }
    public string? ResponseBody { get; }

    public GdtrackerApiException(string message, HttpStatusCode statusCode, string? responseBody, Exception? inner = null)
        : base(message, inner)
    {
        StatusCode = statusCode;
        ResponseBody = responseBody;
    }
}

