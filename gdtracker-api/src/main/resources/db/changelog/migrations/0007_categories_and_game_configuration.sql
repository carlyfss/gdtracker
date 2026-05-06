--liquibase formatted sql

--changeset numb-tracker:0007-create-categories
CREATE TABLE categories (
    id       VARCHAR(36) PRIMARY KEY,
    game_id  VARCHAR(36) NOT NULL,
    name     VARCHAR(255) NOT NULL,
    color    VARCHAR(7)   NOT NULL,
    CONSTRAINT fk_categories_game FOREIGN KEY (game_id) REFERENCES games (id)
);

--changeset numb-tracker:0007-categories-indexes
CREATE UNIQUE INDEX uk_categories_game_name_lower ON categories (game_id, LOWER(name));
CREATE INDEX idx_categories_game_id ON categories (game_id);

--changeset numb-tracker:0007-create-game-configurations
CREATE TABLE game_configurations (
    id                                  VARCHAR(36) PRIMARY KEY,
    game_id                             VARCHAR(36) NOT NULL,
    feature_flags                       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    settings                            JSONB       NOT NULL DEFAULT '{}'::jsonb,
    default_exception_task_category_id  VARCHAR(36),
    CONSTRAINT uk_game_configurations_game_id UNIQUE (game_id),
    CONSTRAINT fk_game_configurations_game FOREIGN KEY (game_id) REFERENCES games (id),
    CONSTRAINT fk_game_configurations_default_category FOREIGN KEY (default_exception_task_category_id)
        REFERENCES categories (id) ON DELETE SET NULL
);

--changeset numb-tracker:0007-seed-categories-per-game
INSERT INTO categories (id, game_id, name, color)
SELECT gen_random_uuid()::text, g.id, 'Game exceptions', '#818cf8'
FROM games g;

--changeset numb-tracker:0007-seed-game-configurations
INSERT INTO game_configurations (id, game_id, feature_flags, settings, default_exception_task_category_id)
SELECT gen_random_uuid()::text,
       c.game_id,
       '{}'::jsonb,
       '{}'::jsonb,
       c.id
FROM categories c
WHERE c.name = 'Game exceptions';
