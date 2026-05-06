--liquibase formatted sql

--changeset numb-tracker:0012-drop-uk-features-game-name-lower
DROP INDEX IF EXISTS uk_features_game_name_lower;

--changeset numb-tracker:0012-features-add-parent
ALTER TABLE features
    ADD COLUMN parent_feature_id VARCHAR(36);

--changeset numb-tracker:0012-features-parent-fk
ALTER TABLE features
    ADD CONSTRAINT fk_features_parent FOREIGN KEY (parent_feature_id) REFERENCES features (id);

--changeset numb-tracker:0012-features-parent-index
CREATE INDEX idx_features_parent_feature_id ON features (parent_feature_id);

--changeset numb-tracker:0012-uk-features-root-game-name-lower
CREATE UNIQUE INDEX uk_features_root_game_name_lower ON features (game_id, LOWER(name))
    WHERE parent_feature_id IS NULL;

--changeset numb-tracker:0012-uk-features-child-game-parent-name-lower
CREATE UNIQUE INDEX uk_features_child_game_parent_name_lower ON features (game_id, parent_feature_id, LOWER(name))
    WHERE parent_feature_id IS NOT NULL;
