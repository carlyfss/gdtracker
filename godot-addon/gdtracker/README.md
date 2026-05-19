# GDTracker Godot addon (GDScript)

This addon provides a small GDScript client for GDTracker’s ingest endpoints.

## Setup

1. Copy `godot-addon/gdtracker/` into your Godot project as `res://addons/gdtracker/`.
2. Wire the client into your game: add **Autoload** pointing at `gdtracker_client.gd`, or attach it to a node / `preload("res://addons/gdtracker/gdtracker_client.gd")` and instantiate `GDTrackerClient`.
3. Configure:

    - `api_base_url` (e.g. `http://localhost:8080`)
    - `game_id`
    - `ingest_token`

4. Call `register_player()` once per game session. It sets `player_id` on the client.

## Canonical copy-paste: per-feature integration

Use **[`examples/gdscript_integration_example.gd`](examples/gdscript_integration_example.gd)** as the main template: one `func` per ingest feature (`example_ping_integration`, `example_register_player`, etc.) and shared `GDTrackerClient` configuration in `_configure_client()`.

Event **definition codes** and **parameter keys** must match what you configured in GDTracker for that game.

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

## Notes

- All ingest calls require `Authorization: Bearer <ingest-token>`.
- All ingest calls **except** `register_player()` and `ping_integration()` require `X-Player-Id` (set automatically after `register_player()` on this client).
