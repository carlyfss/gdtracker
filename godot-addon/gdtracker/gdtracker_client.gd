extends Node
class_name GDTrackerClient

@export var api_base_url: String = "http://localhost:8080"
@export var game_id: String = ""
@export var ingest_token: String = ""
@export var player_id: String = ""

signal request_failed(status_code: int, body_text: String)
signal request_ok(status_code: int, body_text: String)

func _base_headers(include_player_id: bool) -> PackedStringArray:
	var headers := PackedStringArray([
		"Content-Type: application/json",
		"Accept: application/json",
		"Authorization: Bearer %s" % ingest_token,
	])
	if include_player_id and player_id.strip_edges() != "":
		headers.append("X-Player-Id: %s" % player_id.strip_edges())
	return headers

func _url(path: String) -> String:
	var base := api_base_url.strip_edges().trim_suffix("/")
	return "%s%s" % [base, path]

func _request(method: int, path: String, headers: PackedStringArray, body: String) -> Array:
	var http := HTTPRequest.new()
	add_child(http)
	var err := http.request(_url(path), headers, method, body)
	if err != OK:
		http.queue_free()
		emit_signal("request_failed", 0, "HTTPRequest error: %s" % err)
		return [0, PackedByteArray()]
	var result = await http.request_completed
	http.queue_free()
	# result: [result, response_code, headers, body]
	var code := int(result[1])
	var body_bytes: PackedByteArray = result[3]
	var body_text := body_bytes.get_string_from_utf8()
	if code >= 200 and code < 300:
		emit_signal("request_ok", code, body_text)
	else:
		emit_signal("request_failed", code, body_text)
	return [code, body_bytes]

func ping_integration() -> bool:
	# POST /api/games/{gameId}/integration (Bearer only)
	var gid := game_id.strip_edges()
	if gid == "":
		push_error("GDTrackerClient: game_id is required")
		return false
	var body := "{\"validation\":\"ok\"}"
	var path := "/api/games/%s/integration" % Uri.encode_www_form(gid)
	var res := await _request(HTTPClient.METHOD_POST, path, _base_headers(false), body)
	return int(res[0]) >= 200 and int(res[0]) < 300

func register_player() -> String:
	# POST /api/games/{gameId}/game-players (Bearer only) -> { playerId }
	var gid := game_id.strip_edges()
	if gid == "":
		push_error("GDTrackerClient: game_id is required")
		return ""
	var path := "/api/games/%s/game-players" % Uri.encode_www_form(gid)
	var res := await _request(HTTPClient.METHOD_POST, path, _base_headers(false), "")
	var code := int(res[0])
	if code < 200 or code >= 300:
		return ""
	var text := (res[1] as PackedByteArray).get_string_from_utf8()
	var parsed = JSON.parse_string(text)
	if typeof(parsed) == TYPE_DICTIONARY and parsed.has("playerId"):
		player_id = str(parsed["playerId"]).strip_edges()
		return player_id
	return ""

func create_event(definition_code: String, parameters: Dictionary = {}) -> bool:
	# POST /api/games/{gameId}/game-events/ingest (Bearer + X-Player-Id)
	var gid := game_id.strip_edges()
	if gid == "" or player_id.strip_edges() == "":
		push_error("GDTrackerClient: game_id and player_id are required (call register_player first)")
		return false
	var body_dict := { "definitionCode": definition_code, "parameters": parameters }
	var body := JSON.stringify(body_dict)
	var path := "/api/games/%s/game-events/ingest" % Uri.encode_www_form(gid)
	var res := await _request(HTTPClient.METHOD_POST, path, _base_headers(true), body)
	return int(res[0]) >= 200 and int(res[0]) < 300

func create_trace(location: String, map: String, game_event_id: String = "") -> bool:
	# POST /api/games/{gameId}/game-trace/ingest (Bearer + X-Player-Id)
	var gid := game_id.strip_edges()
	if gid == "" or player_id.strip_edges() == "":
		push_error("GDTrackerClient: game_id and player_id are required (call register_player first)")
		return false
	var body_dict := { "location": location, "map": map }
	if game_event_id.strip_edges() != "":
		body_dict["gameEventId"] = game_event_id.strip_edges()
	var body := JSON.stringify(body_dict)
	var path := "/api/games/%s/game-trace/ingest" % Uri.encode_www_form(gid)
	var res := await _request(HTTPClient.METHOD_POST, path, _base_headers(true), body)
	return int(res[0]) >= 200 and int(res[0]) < 300

func create_exception(error_message: String, short_error_message: String = "", location: String = "", map: String = "", stack_trace: String = "") -> bool:
	# POST /api/games/{gameId}/game-exceptions/ingest (Bearer + X-Player-Id)
	var gid := game_id.strip_edges()
	if gid == "" or player_id.strip_edges() == "":
		push_error("GDTrackerClient: game_id and player_id are required (call register_player first)")
		return false
	var body_dict := {}
	if error_message.strip_edges() != "":
		body_dict["errorMessage"] = error_message
	if short_error_message.strip_edges() != "":
		body_dict["shortErrorMessage"] = short_error_message
	if location.strip_edges() != "":
		body_dict["location"] = location
	if map.strip_edges() != "":
		body_dict["map"] = map
	if stack_trace.strip_edges() != "":
		body_dict["stackTrace"] = stack_trace
	var body := JSON.stringify(body_dict)
	var path := "/api/games/%s/game-exceptions/ingest" % Uri.encode_www_form(gid)
	var res := await _request(HTTPClient.METHOD_POST, path, _base_headers(true), body)
	return int(res[0]) >= 200 and int(res[0]) < 300

func create_feedback(title: String, description: String, meters: Dictionary = {}) -> bool:
	# POST /api/games/{gameId}/game-feedback/ingest (Bearer + X-Player-Id)
	var gid := game_id.strip_edges()
	if gid == "" or player_id.strip_edges() == "":
		push_error("GDTrackerClient: game_id and player_id are required (call register_player first)")
		return false
	var body_dict := { "title": title, "description": description }
	if meters.size() > 0:
		body_dict["meters"] = meters
	var body := JSON.stringify(body_dict)
	var path := "/api/games/%s/game-feedback/ingest" % Uri.encode_www_form(gid)
	var res := await _request(HTTPClient.METHOD_POST, path, _base_headers(true), body)
	return int(res[0]) >= 200 and int(res[0]) < 300

