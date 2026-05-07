# GDTracker Godot addon (GDScript)

This addon provides a small GDScript client for GDTracker’s ingest endpoints.

## Setup

1. Copy `godot-addon/gdtracker/` into your Godot project as `res://addons/gdtracker/`.
2. Add `gdtracker_client.gd` as an autoload (optional) or instantiate it from a scene.
3. Configure:
   - `api_base_url` (e.g. `http://localhost:8080`)
   - `game_id`
   - `ingest_token`
4. Call `register_player()` once per game session. It sets `player_id`.

## Minimal usage

```gdscript
var c := GDTrackerClient.new()
c.api_base_url = "http://localhost:8080"
c.game_id = "YOUR_GAME_ID"
c.ingest_token = "YOUR_INGEST_TOKEN"

await c.ping_integration()
var player_id := await c.register_player()
await c.create_event("player_died", { "player_id": "123", "enemy": "Zombie" })
```

## Full example (all actions)

```gdscript
extends Node

@onready var c := GDTrackerClient.new()

func _ready() -> void:
    c.api_base_url = "http://localhost:8080"
    c.game_id = "YOUR_GAME_ID"
    c.ingest_token = "YOUR_INGEST_TOKEN"

    await c.ping_integration()
    var player_id := await c.register_player()
    print("GDTracker playerId: ", player_id)

    await c.create_event("player_died", {
        "player_id": "123",
        "enemy": "Zombie",
        "map": "proto-dungeon",
        "location": "(35, 22, 17)",
    })

    await c.create_trace("(35, 22, 17)", "proto-dungeon")

    await c.create_exception(
        "NullReferenceException",
        "NRE",
        "(35, 22, 17)",
        "proto-dungeon",
        "at Player.tick()\\n..."
    )

    await c.create_feedback("Great session", "Loved the new level.", {
        "game_fun": 8,
        "balance": 6,
    })
```

## Notes

- All ingest calls require `Authorization: Bearer <ingest-token>`.
- All ingest calls **except** `register_player()` and `ping_integration()` require `X-Player-Id`.

