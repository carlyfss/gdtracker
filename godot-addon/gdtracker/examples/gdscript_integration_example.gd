extends Node
## Copy this script into your game (or attach as a scene root) after installing the addon under `res://addons/gdtracker/`.
## One function per ingest feature; set credentials in `_configure_client()`.

var _client := GDTrackerClient.new()


func _ready() -> void:
    _configure_client()


func _configure_client() -> void:
    _client.api_base_url = "http://localhost:8080"
    _client.game_id = "REPLACE_ME"
    _client.ingest_token = "REPLACE_ME"


func format_vector3(location: Vector3) -> String:
    return "(%s, %s, %s)" % [location.x, location.y, location.z]


func example_ping_integration() -> void:
    await _client.ping_integration()


func example_register_player() -> void:
    var player_id := await _client.register_player()
    print("GDTracker playerId: ", player_id)


func example_create_event(
    event_id: String,
    player_id: String,
    key: String,
    value: String,
    map_name: String,
    location: Vector3,
) -> void:
    await _client.create_event(event_id, {
        "playerId": player_id,
        "key": key,
        "value": value,
        "map": map_name,
        "location": format_vector3(location),
    })


func example_create_trace(map_name: String, location: Vector3) -> void:
    await _client.create_trace(format_vector3(location), map_name)


func example_create_exception() -> void:
    await _client.create_exception(
        "NullReferenceException",
        "NRE",
        "(35, 22, 17)",
        "proto-dungeon",
        "at Player.tick()\\n...",
    )


func example_create_feedback() -> void:
    await _client.create_feedback("Great session", "Loved the new level.", {
        "game_fun": 8,
        "balance": 6,
    })
