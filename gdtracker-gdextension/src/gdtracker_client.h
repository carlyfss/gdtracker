#pragma once

#include <godot_cpp/classes/ref_counted.hpp>
#include <godot_cpp/core/class_db.hpp>

namespace godot {

class GDTrackerClient : public RefCounted {
    GDCLASS(GDTrackerClient, RefCounted)

private:
    String api_base_url;
    String game_id;
    String ingest_token;
    String player_id;

protected:
    static void _bind_methods();

public:
    GDTrackerClient();

    void set_api_base_url(const String &p_base_url);
    String get_api_base_url() const;

    void set_game_id(const String &p_game_id);
    String get_game_id() const;

    void set_ingest_token(const String &p_token);
    String get_ingest_token() const;

    String get_player_id() const;

    bool ping_integration();
    String register_player();
};

} // namespace godot

