ALTER TABLE trace_locations RENAME TO game_event_traces;

ALTER INDEX idx_trace_locations_timestamp RENAME TO idx_game_event_traces_timestamp;

ALTER INDEX idx_trace_locations_game_id RENAME TO idx_game_event_traces_game_id;

ALTER TABLE game_event_traces RENAME CONSTRAINT fk_trace_locations_game TO fk_game_event_traces_game;

ALTER TABLE game_event_traces ADD COLUMN game_event_id VARCHAR(36) NULL;

ALTER TABLE game_event_traces
    ADD CONSTRAINT fk_game_event_traces_game_event
    FOREIGN KEY (game_event_id) REFERENCES game_events (id) ON DELETE SET NULL;

CREATE INDEX idx_game_event_traces_game_event_id ON game_event_traces (game_event_id);
