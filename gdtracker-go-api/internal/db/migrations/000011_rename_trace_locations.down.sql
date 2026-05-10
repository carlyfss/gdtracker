DROP INDEX IF EXISTS idx_game_event_traces_game_event_id;

ALTER TABLE game_event_traces DROP CONSTRAINT IF EXISTS fk_game_event_traces_game_event;

ALTER TABLE game_event_traces DROP COLUMN IF EXISTS game_event_id;

ALTER TABLE game_event_traces RENAME CONSTRAINT fk_game_event_traces_game TO fk_trace_locations_game;

ALTER INDEX idx_game_event_traces_game_id RENAME TO idx_trace_locations_game_id;

ALTER INDEX idx_game_event_traces_timestamp RENAME TO idx_trace_locations_timestamp;

ALTER TABLE game_event_traces RENAME TO trace_locations;
