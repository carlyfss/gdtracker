--liquibase formatted sql

--changeset numb-tracker:0019-game-exception-task-sequences
CREATE TABLE game_exception_task_sequences (
    game_exception_id VARCHAR(36) PRIMARY KEY,
    next_index        INTEGER     NOT NULL,
    CONSTRAINT fk_gets_game_exception FOREIGN KEY (game_exception_id) REFERENCES game_exceptions (id) ON DELETE CASCADE
);

-- First assignment uses index 1; row stores the next index to assign (starts at 2).
--changeset numb-tracker:0019-game-exception-task-sequences-comment
COMMENT ON COLUMN game_exception_task_sequences.next_index IS 'Next index to assign; first reservation returns 1.';
