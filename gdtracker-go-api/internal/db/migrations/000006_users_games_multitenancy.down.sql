DROP INDEX IF EXISTS idx_trace_locations_game_id;
DROP INDEX IF EXISTS idx_game_exceptions_game_id;
DROP INDEX IF EXISTS idx_features_game_id;
DROP INDEX IF EXISTS uk_features_game_name_lower;

ALTER TABLE trace_locations DROP CONSTRAINT IF EXISTS fk_trace_locations_game;
ALTER TABLE game_exceptions DROP CONSTRAINT IF EXISTS fk_game_exceptions_game;
ALTER TABLE features DROP CONSTRAINT IF EXISTS fk_features_game;

ALTER TABLE trace_locations DROP COLUMN IF EXISTS game_id;
ALTER TABLE game_exceptions DROP COLUMN IF EXISTS game_id;
ALTER TABLE features DROP COLUMN IF EXISTS game_id;

DELETE FROM games WHERE id = '22222222-2222-2222-2222-222222222222';
DELETE FROM users WHERE id = '11111111-1111-1111-1111-111111111111';

DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS users;

ALTER TABLE features ADD CONSTRAINT uk_features_name UNIQUE (name);
