# GDTracker .NET SDK (Godot-friendly)

This is a small .NET client for GDTracker’s **ingest** endpoints (Bearer ingest token + per-session `playerId`).

## Install / use in a Godot C# project

1. **Build the SDK locally** (from this directory):

    ```bash
    dotnet restore
    dotnet build -c Release
    ```

2. **Reference the SDK from your Godot game**
    - In Godot: **Project → Tools → C# → Create C# solution** (once), then open the generated `.sln` in your IDE.
    - Add a **project reference** to [`src/GdtrackerSdk/GdtrackerSdk.csproj`](src/GdtrackerSdk/GdtrackerSdk.csproj):
        - **Visual Studio / Rider:** add existing project → `GdtrackerSdk.csproj`, then add reference from your game assembly to `GdtrackerSdk`.
        - **By hand:** in your game’s `.csproj` (next to `project.godot`), add an item such as:

            ```xml
            <ItemGroup>
              <ProjectReference Include="..\..\gdtracker\gdtracker-sdk-dotnet\src\GdtrackerSdk\GdtrackerSdk.csproj" />
            </ItemGroup>
            ```

            Adjust the **relative path** so it resolves from your game project file to this repo’s `GdtrackerSdk.csproj` (layout differs if the SDK is copied into your game repo).

    - Alternatively, copy `src/GdtrackerSdk/` into your own repo and reference that copy.

3. **Configure**

    - **BaseUrl**: e.g. `http://localhost:8080` (scheme optional: `localhost:8080` is accepted)
    - **GameId**: from the GDTracker UI route for your game
    - **IngestToken**: Configuration → Ingest token (**do not commit** it)

4. **Call flow**

    1. `PingIntegration()` (optional; updates the Integration status page)
    2. `RegisterPlayer()` (returns and stores `playerId` on the client options)
    3. `CreateEvent`, `CreateTrace`, `CreateException`, `CreateFeedback` (require `X-Player-Id` from step 2)

## Canonical copy-paste: per-feature integration

Use **[`examples/godot-csharp/GdtrackerIntegration.cs`](examples/godot-csharp/GdtrackerIntegration.cs)** as the main template: one static helper per ingest feature, optional `Configure()` for editor `[Export]` fields, and `SafeRun` for `try`/`catch` around `GdtrackerApiException`.

A minimal **smoke-test Node** that wires `[Export]` into `Configure` and calls each helper once: [`examples/godot-csharp/GdtrackerExample.cs`](examples/godot-csharp/GdtrackerExample.cs).

### `async void` vs `Task`

The helpers return **`Task`** so you can `await` them from `async void _Ready()` or from `async void` signal handlers. If you use **`async void`** on your own wrappers, unhandled exceptions can be harder to notice—prefer `await` inside `_Ready()` or use `SafeRun` as in `GdtrackerExample.cs`.

### Full client usage (inline, all actions)

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
- **`GdtrackerClient`** implements `IDisposable`; a long-lived static client (as in `GdtrackerIntegration`) is fine for a game session. If you create many clients, dispose them when done.
- Event **definition codes** and **parameter keys** must match what you configured in GDTracker for that game.
