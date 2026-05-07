# GDTracker .NET SDK (Godot-friendly)

This is a small .NET client for GDTracker’s **ingest** endpoints (Bearer ingest token + per-session `playerId`).

## Install / use in a Godot C# project

- Add the SDK project to your Godot solution:
  - Add a **project reference** to `gdtracker-sdk-dotnet/src/GdtrackerSdk/GdtrackerSdk.csproj`, or copy `src/GdtrackerSdk/` into your repo and reference it there.
- Configure:
  - **BaseUrl**: e.g. `http://localhost:8080`
  - **GameId**: the current game id from the GDTracker UI route
  - **IngestToken**: from Configuration → Ingest token (do not commit it)
- Call flow:
  1. `PingIntegration()` (optional connectivity check; updates the Integration status page)
  2. `RegisterPlayer()` (returns and stores `playerId`)
  3. Create calls (`CreateEvent`, `CreateTrace`, `CreateException`, `CreateFeedback`) which require `X-Player-Id`

Example script: `examples/godot-csharp/GdtrackerExample.cs`.

## Build (local)

From `gdtracker-sdk-dotnet/`:

```bash
dotnet restore
dotnet build -c Release
```

## Full example (all actions)

```csharp
using System.Collections.Generic;
using Gdtracker;
using Godot;

public partial class GdtrackerSdkExample : Node
{
    private readonly GdtrackerClient _client = new(new GdtrackerClientOptions
    {
        BaseUrl = "http://localhost:8080",
        GameId = "YOUR_GAME_ID",
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
}
```

## Notes

- **Do not** commit ingest tokens to source control.
- `BaseUrl` can be `http://localhost:8080` or `localhost:8080` (scheme is optional).

