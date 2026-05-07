#include "gdtracker_client.h"

#include <godot_cpp/classes/http_client.hpp>
#include <godot_cpp/classes/json.hpp>
#include <godot_cpp/variant/dictionary.hpp>
#include <godot_cpp/variant/packed_byte_array.hpp>

using namespace godot;

GDTrackerClient::GDTrackerClient() {
    api_base_url = "http://localhost:8080";
}

void GDTrackerClient::_bind_methods() {
    ClassDB::bind_method(D_METHOD("set_api_base_url", "api_base_url"), &GDTrackerClient::set_api_base_url);
    ClassDB::bind_method(D_METHOD("get_api_base_url"), &GDTrackerClient::get_api_base_url);
    ADD_PROPERTY(PropertyInfo(Variant::STRING, "api_base_url"), "set_api_base_url", "get_api_base_url");

    ClassDB::bind_method(D_METHOD("set_game_id", "game_id"), &GDTrackerClient::set_game_id);
    ClassDB::bind_method(D_METHOD("get_game_id"), &GDTrackerClient::get_game_id);
    ADD_PROPERTY(PropertyInfo(Variant::STRING, "game_id"), "set_game_id", "get_game_id");

    ClassDB::bind_method(D_METHOD("set_ingest_token", "ingest_token"), &GDTrackerClient::set_ingest_token);
    ClassDB::bind_method(D_METHOD("get_ingest_token"), &GDTrackerClient::get_ingest_token);
    ADD_PROPERTY(PropertyInfo(Variant::STRING, "ingest_token"), "set_ingest_token", "get_ingest_token");

    ClassDB::bind_method(D_METHOD("get_player_id"), &GDTrackerClient::get_player_id);

    ClassDB::bind_method(D_METHOD("ping_integration"), &GDTrackerClient::ping_integration);
    ClassDB::bind_method(D_METHOD("register_player"), &GDTrackerClient::register_player);
}

void GDTrackerClient::set_api_base_url(const String &p_base_url) {
    api_base_url = p_base_url;
}

String GDTrackerClient::get_api_base_url() const {
    return api_base_url;
}

void GDTrackerClient::set_game_id(const String &p_game_id) {
    game_id = p_game_id;
}

String GDTrackerClient::get_game_id() const {
    return game_id;
}

void GDTrackerClient::set_ingest_token(const String &p_token) {
    ingest_token = p_token;
}

String GDTrackerClient::get_ingest_token() const {
    return ingest_token;
}

String GDTrackerClient::get_player_id() const {
    return player_id;
}

static String _trim_trailing_slash(const String &s) {
    if (s.length() > 0 && s[s.length() - 1] == '/') {
        return s.substr(0, s.length() - 1);
    }
    return s;
}

static bool _parse_base_url(const String &base, String &out_host, int &out_port, bool &out_tls) {
    // Minimal parsing for http(s)://host:port forms.
    String b = base.strip_edges();
    out_tls = false;

    if (b.begins_with("https://")) {
        out_tls = true;
        b = b.substr(8, b.length() - 8);
    } else if (b.begins_with("http://")) {
        b = b.substr(7, b.length() - 7);
    }

    // Remove path if present.
    int slash = b.find("/");
    if (slash >= 0) {
        b = b.substr(0, slash);
    }

    int colon = b.find(":");
    if (colon >= 0) {
        out_host = b.substr(0, colon);
        String p = b.substr(colon + 1, b.length() - colon - 1);
        out_port = p.to_int();
    } else {
        out_host = b;
        out_port = out_tls ? 443 : 80;
    }

    return out_host.length() > 0 && out_port > 0;
}

static Dictionary _make_json_body(const Dictionary &d) {
    // JSON::stringify expects Variant.
    return d;
}

bool GDTrackerClient::ping_integration() {
    if (game_id.strip_edges().is_empty() || ingest_token.strip_edges().is_empty()) {
        return false;
    }

    String host;
    int port = 0;
    bool tls = false;
    if (!_parse_base_url(api_base_url, host, port, tls)) {
        return false;
    }

    HTTPClient http;
    Error err = http.connect_to_host(host, port, tls);
    if (err != OK) {
        return false;
    }
    while (http.get_status() == HTTPClient::STATUS_CONNECTING || http.get_status() == HTTPClient::STATUS_RESOLVING) {
        http.poll();
    }
    if (http.get_status() != HTTPClient::STATUS_CONNECTED) {
        return false;
    }

    Array headers;
    headers.append("Content-Type: application/json");
    headers.append("Accept: application/json");
    headers.append(String("Authorization: Bearer ") + ingest_token);

    Dictionary body_dict;
    body_dict["validation"] = "ok";
    String body = JSON::stringify(_make_json_body(body_dict));

    String path = String("/api/games/") + Uri::encode_www_form(game_id) + "/integration";
    err = http.request(HTTPClient::METHOD_POST, path, headers, body);
    if (err != OK) {
        return false;
    }

    while (http.get_status() == HTTPClient::STATUS_REQUESTING) {
        http.poll();
    }

    int code = http.get_response_code();
    http.close();
    return code >= 200 && code < 300;
}

String GDTrackerClient::register_player() {
    if (game_id.strip_edges().is_empty() || ingest_token.strip_edges().is_empty()) {
        return "";
    }

    String host;
    int port = 0;
    bool tls = false;
    if (!_parse_base_url(api_base_url, host, port, tls)) {
        return "";
    }

    HTTPClient http;
    Error err = http.connect_to_host(host, port, tls);
    if (err != OK) {
        return "";
    }
    while (http.get_status() == HTTPClient::STATUS_CONNECTING || http.get_status() == HTTPClient::STATUS_RESOLVING) {
        http.poll();
    }
    if (http.get_status() != HTTPClient::STATUS_CONNECTED) {
        return "";
    }

    Array headers;
    headers.append("Accept: application/json");
    headers.append(String("Authorization: Bearer ") + ingest_token);

    String path = String("/api/games/") + Uri::encode_www_form(game_id) + "/game-players";
    err = http.request(HTTPClient::METHOD_POST, path, headers, "");
    if (err != OK) {
        return "";
    }

    while (http.get_status() == HTTPClient::STATUS_REQUESTING) {
        http.poll();
    }

    int code = http.get_response_code();
    if (code < 200 || code >= 300) {
        http.close();
        return "";
    }

    PackedByteArray bytes = http.read_response_body_chunk();
    String body = bytes.get_string_from_utf8();
    http.close();

    Variant parsed = JSON::parse_string(body);
    if (parsed.get_type() == Variant::DICTIONARY) {
        Dictionary d = parsed;
        if (d.has("playerId")) {
            player_id = String(d["playerId"]).strip_edges();
            return player_id;
        }
    }
    return "";
}

