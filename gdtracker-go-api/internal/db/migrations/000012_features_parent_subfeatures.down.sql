DROP INDEX IF EXISTS uk_features_child_game_parent_name_lower;
DROP INDEX IF EXISTS uk_features_root_game_name_lower;
DROP INDEX IF EXISTS idx_features_parent_feature_id;

ALTER TABLE features DROP CONSTRAINT IF EXISTS fk_features_parent;
ALTER TABLE features DROP COLUMN IF EXISTS parent_feature_id;

CREATE UNIQUE INDEX uk_features_game_name_lower ON features (game_id, LOWER(name));
