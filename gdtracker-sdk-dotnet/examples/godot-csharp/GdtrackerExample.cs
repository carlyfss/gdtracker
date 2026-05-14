using System.Collections.Generic;
using System.Threading.Tasks;
using Gdtracker;
using Godot;

/// <summary>Minimal smoke test: configure from the editor, then run the ingest flow once.</summary>
public partial class GdtrackerExample : Node
{
    [Export] public string ApiBaseUrl = "http://localhost:8080";
    [Export] public string GameId = "REPLACE_ME";
    [Export] public string IngestToken = "REPLACE_ME";

    public override async void _Ready()
    {
        GdtrackerIntegration.Configure(new GdtrackerClientOptions
        {
            BaseUrl = ApiBaseUrl,
            GameId = GameId,
            IngestToken = IngestToken,
        });

        await GdtrackerIntegration.SafeRun(async () =>
        {
            await GdtrackerIntegration.PingIntegration();
            var playerId = await GdtrackerIntegration.RegisterPlayer();
            GD.Print($"GDTracker playerId: {playerId}");

            await GdtrackerIntegration.CreateEvent(
                "player_died",
                playerId: "123",
                key: "cause",
                value: "zombie",
                map: "proto-dungeon",
                location: new Vector3(35, 22, 17));

            await GdtrackerIntegration.CreateTrace("proto-dungeon", new Vector3(35, 22, 17));

            await GdtrackerIntegration.CreateException(
                errorMessage: "NullReferenceException",
                shortErrorMessage: "NRE",
                location: "(35, 22, 17)",
                map: "proto-dungeon",
                stackTrace: "at Player.Tick()\n...");

            await GdtrackerIntegration.CreateFeedback(
                "Great session",
                "Loved the new level.",
                new Dictionary<string, int> { { "game_fun", 8 }, { "balance", 6 } });
        });
    }
}
