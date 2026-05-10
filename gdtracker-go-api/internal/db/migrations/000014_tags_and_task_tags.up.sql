CREATE TABLE tags (
    id          VARCHAR(36) PRIMARY KEY,
    game_id     VARCHAR(36) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    color       VARCHAR(7)   NOT NULL,
    description TEXT,
    CONSTRAINT fk_tags_game FOREIGN KEY (game_id) REFERENCES games (id)
);

CREATE UNIQUE INDEX uk_tags_game_name_lower ON tags (game_id, LOWER(name));
CREATE INDEX idx_tags_game_id ON tags (game_id);

CREATE TABLE task_tags (
    task_id VARCHAR(36) NOT NULL,
    tag_id  VARCHAR(36) NOT NULL,
    PRIMARY KEY (task_id, tag_id),
    CONSTRAINT fk_task_tags_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT fk_task_tags_tag  FOREIGN KEY (tag_id)  REFERENCES tags  (id) ON DELETE CASCADE
);

CREATE INDEX idx_task_tags_tag_id ON task_tags (tag_id);
