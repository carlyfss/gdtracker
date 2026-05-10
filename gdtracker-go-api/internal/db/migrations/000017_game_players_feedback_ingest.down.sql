ALTER TABLE game_exceptions DROP CONSTRAINT IF EXISTS fk_game_exceptions_game_player;
ALTER TABLE game_exceptions DROP COLUMN IF EXISTS game_player_id;

ALTER TABLE game_event_traces DROP CONSTRAINT IF EXISTS fk_game_event_traces_game_player;
ALTER TABLE game_event_traces DROP COLUMN IF EXISTS game_player_id;

ALTER TABLE game_events DROP CONSTRAINT IF EXISTS fk_game_events_game_player;
ALTER TABLE game_events DROP COLUMN IF EXISTS game_player_id;

DROP TABLE IF EXISTS game_feedback CASCADE;
DROP TABLE IF EXISTS game_feedback_meter_definitions CASCADE;
DROP TABLE IF EXISTS game_players CASCADE;
