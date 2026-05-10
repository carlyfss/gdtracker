CREATE TABLE users (
    id       VARCHAR(36) PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    CONSTRAINT uk_users_username UNIQUE (username)
);

CREATE TABLE games (
    id      VARCHAR(36) PRIMARY KEY,
    name    VARCHAR(255) NOT NULL,
    user_id VARCHAR(36)  NOT NULL,
    CONSTRAINT fk_games_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX idx_games_user_id ON games (user_id);

ALTER TABLE features ADD COLUMN game_id VARCHAR(36);

ALTER TABLE game_exceptions ADD COLUMN game_id VARCHAR(36);

ALTER TABLE trace_locations ADD COLUMN game_id VARCHAR(36);

INSERT INTO users (id, username, password)
VALUES ('11111111-1111-1111-1111-111111111111', 'legacy', 'legacy');

INSERT INTO games (id, name, user_id)
VALUES ('22222222-2222-2222-2222-222222222222', 'Default game', '11111111-1111-1111-1111-111111111111');

UPDATE features SET game_id = '22222222-2222-2222-2222-222222222222' WHERE game_id IS NULL;
UPDATE game_exceptions SET game_id = '22222222-2222-2222-2222-222222222222' WHERE game_id IS NULL;
UPDATE trace_locations SET game_id = '22222222-2222-2222-2222-222222222222' WHERE game_id IS NULL;

ALTER TABLE features ALTER COLUMN game_id SET NOT NULL;

ALTER TABLE game_exceptions ALTER COLUMN game_id SET NOT NULL;

ALTER TABLE trace_locations ALTER COLUMN game_id SET NOT NULL;

ALTER TABLE features
    ADD CONSTRAINT fk_features_game FOREIGN KEY (game_id) REFERENCES games (id);

ALTER TABLE game_exceptions
    ADD CONSTRAINT fk_game_exceptions_game FOREIGN KEY (game_id) REFERENCES games (id);

ALTER TABLE trace_locations
    ADD CONSTRAINT fk_trace_locations_game FOREIGN KEY (game_id) REFERENCES games (id);

ALTER TABLE features DROP CONSTRAINT uk_features_name;

CREATE UNIQUE INDEX uk_features_game_name_lower ON features (game_id, LOWER(name));

CREATE INDEX idx_features_game_id ON features (game_id);

CREATE INDEX idx_game_exceptions_game_id ON game_exceptions (game_id);

CREATE INDEX idx_trace_locations_game_id ON trace_locations (game_id);
