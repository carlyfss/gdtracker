DROP TABLE IF EXISTS game_events CASCADE;
DROP TABLE IF EXISTS game_event_definitions CASCADE;

ALTER TABLE games DROP COLUMN IF EXISTS ingest_token_hash;
ALTER TABLE games DROP COLUMN IF EXISTS ingest_token_created_at;
