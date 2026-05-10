-- IF NOT EXISTS: allows re-applying this version after a failed run left the table in place (dirty repair).
CREATE TABLE IF NOT EXISTS game_exception_task_sequences (
    game_exception_id VARCHAR(36) PRIMARY KEY,
    next_index        INTEGER     NOT NULL,
    CONSTRAINT fk_gets_game_exception FOREIGN KEY (game_exception_id) REFERENCES game_exceptions (id) ON DELETE CASCADE
);

COMMENT ON COLUMN game_exception_task_sequences.next_index IS 'Next index to assign, first reservation returns 1.';
