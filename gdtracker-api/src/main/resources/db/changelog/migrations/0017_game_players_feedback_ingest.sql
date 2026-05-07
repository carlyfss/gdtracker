--liquibase formatted sql

--changeset numb-tracker:0017-game-players
CREATE TABLE game_players (
    id         VARCHAR(36) PRIMARY KEY,
    game_id    VARCHAR(36)  NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL,
    CONSTRAINT fk_game_players_game FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE
);

--changeset numb-tracker:0017-game-players-indexes
CREATE INDEX idx_game_players_game_id ON game_players (game_id);
CREATE INDEX idx_game_players_game_id_id ON game_players (game_id, id);

--changeset numb-tracker:0017-game-feedback-meter-definitions
CREATE TABLE game_feedback_meter_definitions (
    id          VARCHAR(36) PRIMARY KEY,
    game_id     VARCHAR(36)  NOT NULL,
    field_key   VARCHAR(64)  NOT NULL,
    question    VARCHAR(500) NOT NULL,
    sort_order  INT          NOT NULL DEFAULT 0,
    CONSTRAINT fk_game_feedback_meter_definitions_game FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE
);

--changeset numb-tracker:0017-game-feedback-meter-definitions-indexes
CREATE UNIQUE INDEX uk_game_feedback_meter_definitions_game_field_key_lower
    ON game_feedback_meter_definitions (game_id, LOWER(field_key));
CREATE INDEX idx_game_feedback_meter_definitions_game_id ON game_feedback_meter_definitions (game_id);

--changeset numb-tracker:0017-game-feedback
CREATE TABLE game_feedback (
    id              VARCHAR(36) PRIMARY KEY,
    game_id         VARCHAR(36) NOT NULL,
    game_player_id  VARCHAR(36) NOT NULL,
    title           VARCHAR(500) NOT NULL,
    description     TEXT         NOT NULL,
    meters          JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ  NOT NULL,
    CONSTRAINT fk_game_feedback_game FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE,
    CONSTRAINT fk_game_feedback_player FOREIGN KEY (game_player_id) REFERENCES game_players (id) ON DELETE CASCADE
);

--changeset numb-tracker:0017-game-feedback-indexes
CREATE INDEX idx_game_feedback_game_id_created ON game_feedback (game_id, created_at DESC);

--changeset numb-tracker:0017-game-events-player
ALTER TABLE game_events ADD COLUMN game_player_id VARCHAR(36);

--changeset numb-tracker:0017-game-events-player-fk
ALTER TABLE game_events
    ADD CONSTRAINT fk_game_events_game_player FOREIGN KEY (game_player_id) REFERENCES game_players (id) ON DELETE SET NULL;

--changeset numb-tracker:0017-game-event-traces-player
ALTER TABLE game_event_traces ADD COLUMN game_player_id VARCHAR(36);

--changeset numb-tracker:0017-game-event-traces-player-fk
ALTER TABLE game_event_traces
    ADD CONSTRAINT fk_game_event_traces_game_player FOREIGN KEY (game_player_id) REFERENCES game_players (id) ON DELETE SET NULL;

--changeset numb-tracker:0017-game-exceptions-player
ALTER TABLE game_exceptions ADD COLUMN game_player_id VARCHAR(36);

--changeset numb-tracker:0017-game-exceptions-player-fk
ALTER TABLE game_exceptions
    ADD CONSTRAINT fk_game_exceptions_game_player FOREIGN KEY (game_player_id) REFERENCES game_players (id) ON DELETE SET NULL;
