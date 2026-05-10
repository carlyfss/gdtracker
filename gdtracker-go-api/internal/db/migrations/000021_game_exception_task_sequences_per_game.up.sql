-- IF NOT EXISTS: same recovery pattern as 000019.
CREATE TABLE IF NOT EXISTS game_exception_task_sequences_per_game (
    game_id    VARCHAR(36) PRIMARY KEY,
    next_index INTEGER     NOT NULL,
    CONSTRAINT fk_getspg_game FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE
);

COMMENT ON COLUMN game_exception_task_sequences_per_game.next_index IS 'Next index to assign, first reservation returns 1.';
