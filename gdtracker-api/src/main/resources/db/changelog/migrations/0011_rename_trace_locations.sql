--liquibase formatted sql

--changeset numb-tracker:0011-rename-trace-locations-table
ALTER TABLE trace_locations RENAME TO game_event_traces;

--changeset numb-tracker:0011-rename-trace-locations-timestamp-index
ALTER INDEX idx_trace_locations_timestamp RENAME TO idx_game_event_traces_timestamp;

--changeset numb-tracker:0011-rename-trace-locations-game-id-index
ALTER INDEX idx_trace_locations_game_id RENAME TO idx_game_event_traces_game_id;

--changeset numb-tracker:0011-rename-trace-locations-game-fk
ALTER TABLE game_event_traces RENAME CONSTRAINT fk_trace_locations_game TO fk_game_event_traces_game;

--changeset numb-tracker:0011-add-game-event-id
ALTER TABLE game_event_traces ADD COLUMN game_event_id VARCHAR(36) NULL;

--changeset numb-tracker:0011-add-game-event-fk
ALTER TABLE game_event_traces
    ADD CONSTRAINT fk_game_event_traces_game_event
    FOREIGN KEY (game_event_id) REFERENCES game_events (id) ON DELETE SET NULL;

--changeset numb-tracker:0011-add-game-event-id-index
CREATE INDEX idx_game_event_traces_game_event_id ON game_event_traces (game_event_id);
