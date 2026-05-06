--liquibase formatted sql

--changeset numb-tracker:0009-games-ingest-token
ALTER TABLE games
    ADD COLUMN ingest_token_hash VARCHAR(255),
    ADD COLUMN ingest_token_created_at TIMESTAMPTZ;

--changeset numb-tracker:0009-game-event-definitions
CREATE TABLE game_event_definitions (
    id               VARCHAR(36) PRIMARY KEY,
    game_id          VARCHAR(36)  NOT NULL,
    code             VARCHAR(64)  NOT NULL,
    display_name     VARCHAR(255),
    message_template VARCHAR(100) NOT NULL,
    image_data       TEXT,
    CONSTRAINT fk_game_event_definitions_game FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE
);

--changeset numb-tracker:0009-game-event-definitions-indexes
CREATE UNIQUE INDEX uk_game_event_definitions_game_code_lower
    ON game_event_definitions (game_id, LOWER(code));
CREATE INDEX idx_game_event_definitions_game_id ON game_event_definitions (game_id);

--changeset numb-tracker:0009-game-events
CREATE TABLE game_events (
    id               VARCHAR(36) PRIMARY KEY,
    game_id          VARCHAR(36) NOT NULL,
    definition_id    VARCHAR(36) NOT NULL,
    rendered_message VARCHAR(100) NOT NULL,
    payload          JSONB       NOT NULL DEFAULT '{}'::jsonb,
    timestamp        TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_game_events_game FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE,
    CONSTRAINT fk_game_events_definition FOREIGN KEY (definition_id)
        REFERENCES game_event_definitions (id) ON DELETE RESTRICT
);

--changeset numb-tracker:0009-game-events-indexes
CREATE INDEX idx_game_events_game_id_timestamp ON game_events (game_id, timestamp DESC);
