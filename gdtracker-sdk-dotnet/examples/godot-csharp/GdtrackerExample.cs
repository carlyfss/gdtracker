using System.Collections.Generic;
using System.Threading.Tasks;
using Gdtracker;
using Godot;

public partial class GdtrackerExample : Node
{
    [Export] public string ApiBaseUrl = "http://localhost:8080";
    [Export] public string GameId = "REPLACE_ME";
    [Export] public string IngestToken = "REPLACE_ME";

    public override async void _Ready()
    {
        var client = new GdtrackerClient(new GdtrackerClientOptions
        {
            BaseUrl = ApiBaseUrl,
            GameId = GameId,
            IngestToken = IngestToken,
        });

        try
        {
            await client.PingIntegration();
            var playerId = await client.RegisterPlayer();
            GD.Print($"GDTracker playerId: {playerId}");

            await client.CreateEvent(
                definitionCode: "player_died",
                parameters: new Dictionary<string, string>
                {
                    { "player_id", "123" },
                    { "enemy", "Zombie" },
                    { "map", "proto-dungeon" },
                    { "location", "(35, 22, 17)" },
                }
            );

            await client.CreateTrace(location: "(35, 22, 17)", map: "proto-dungeon");
        }
        catch (GdtrackerApiException ex)
        {
            GD.PushError($"GDTracker API error: {(int)ex.StatusCode} {ex.Message}\n{ex.ResponseBody}");
        }
    }
}

