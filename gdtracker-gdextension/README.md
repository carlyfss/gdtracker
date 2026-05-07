# GDTracker GDExtension (experimental)

This is an **experimental** GDExtension wrapper to call GDTracker ingest endpoints from **GDScript** without writing HTTP code yourself.

If you don’t want to compile native code, use the pure-GDScript addon instead: `godot-addon/gdtracker/`.

## What’s implemented

- `ping_integration()` → `POST /api/games/{gameId}/integration` with JSON `{"validation":"ok"}` (Bearer only)
- `register_player()` → `POST /api/games/{gameId}/game-players` (Bearer only) returns `playerId`

## Usage (GDScript)

```gdscript
extends Node

func _ready() -> void:
    var c := GDTrackerClient.new()
    c.api_base_url = "http://localhost:8080"
    c.game_id = "YOUR_GAME_ID"
    c.ingest_token = "YOUR_INGEST_TOKEN"

    var ok := c.ping_integration()
    print("Ping ok: ", ok)

    var player_id := c.register_player()
    print("playerId: ", player_id)
```

## Build notes

Godot 4 GDExtensions typically build against [`godot-cpp`](https://github.com/godotengine/godot-cpp). This repo does **not** vendor `godot-cpp` yet.

Suggested approach:

1. Add `godot-cpp` as a submodule or clone it beside this folder.
2. Generate bindings as per Godot’s docs.
3. Add a build (SCons or CMake) that compiles `src/*.cpp` and links against `godot-cpp`.
4. Copy the produced binary into your Godot project under:
   - `res://addons/gdtracker_native/bin/` (see `gdtracker.gdextension` for expected filenames)
5. Copy `gdtracker.gdextension` into your Godot project (same addon folder) and enable it.

This folder intentionally keeps the C++ side minimal so you can wire it into whatever build system you already use.

