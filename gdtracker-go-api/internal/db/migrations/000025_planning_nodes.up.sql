CREATE TABLE planning_nodes (
    id                VARCHAR(36) PRIMARY KEY,
    game_id           VARCHAR(36)  NOT NULL,
    parent_id         VARCHAR(36),
    kind              VARCHAR(32)  NOT NULL,
    name              VARCHAR(512) NOT NULL,
    sort_order        INT          NOT NULL DEFAULT 0,
    markdown_body     TEXT,
    excalidraw_scene  JSONB,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_planning_nodes_game FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE,
    CONSTRAINT fk_planning_nodes_parent FOREIGN KEY (parent_id) REFERENCES planning_nodes (id) ON DELETE CASCADE,
    CONSTRAINT chk_planning_nodes_kind CHECK (kind IN ('folder', 'markdown', 'excalidraw'))
);

CREATE INDEX idx_planning_nodes_game_id ON planning_nodes (game_id);

CREATE INDEX idx_planning_nodes_parent_id ON planning_nodes (parent_id);

CREATE UNIQUE INDEX uk_planning_nodes_game_root_name_lower
    ON planning_nodes (game_id, LOWER(name))
    WHERE parent_id IS NULL;

CREATE UNIQUE INDEX uk_planning_nodes_game_parent_name_lower
    ON planning_nodes (game_id, parent_id, LOWER(name))
    WHERE parent_id IS NOT NULL;
