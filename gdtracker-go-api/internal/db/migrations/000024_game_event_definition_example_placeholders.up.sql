ALTER TABLE game_event_definitions
    ADD COLUMN example_placeholder_values JSONB NOT NULL DEFAULT '{}'::jsonb;
