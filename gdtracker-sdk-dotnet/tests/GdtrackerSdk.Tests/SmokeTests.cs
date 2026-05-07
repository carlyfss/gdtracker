using System;
using System.Threading.Tasks;
using Xunit;

namespace GdtrackerSdk.Tests;

public sealed class SmokeTests
{
    [Fact]
    public async Task CanConstructClient()
    {
        var client = new Gdtracker.GdtrackerClient(new Gdtracker.GdtrackerClientOptions
        {
            BaseUrl = "http://localhost:8080",
            GameId = "game",
            IngestToken = "token",
        });

        await Task.CompletedTask;
        client.Dispose();
    }
}

