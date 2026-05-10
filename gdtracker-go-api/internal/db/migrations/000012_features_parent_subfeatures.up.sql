DROP INDEX IF EXISTS uk_features_game_name_lower;

ALTER TABLE features
    ADD COLUMN parent_feature_id VARCHAR(36);

ALTER TABLE features
    ADD CONSTRAINT fk_features_parent FOREIGN KEY (parent_feature_id) REFERENCES features (id);

CREATE INDEX idx_features_parent_feature_id ON features (parent_feature_id);

CREATE UNIQUE INDEX uk_features_root_game_name_lower ON features (game_id, LOWER(name))
    WHERE parent_feature_id IS NULL;

CREATE UNIQUE INDEX uk_features_child_game_parent_name_lower ON features (game_id, parent_feature_id, LOWER(name))
    WHERE parent_feature_id IS NOT NULL;
