--liquibase formatted sql

--changeset numb-tracker:0021-game-exception-task-sequences-per-game
CREATE TABLE game_exception_task_sequences_per_game (
    game_id    VARCHAR(36) PRIMARY KEY,
    next_index INTEGER     NOT NULL,
    CONSTRAINT fk_getspg_game FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE
);

-- First assignment uses index 1; row stores the next index to assign (starts at 2).
--changeset numb-tracker:0021-game-exception-task-sequences-per-game-comment
COMMENT ON COLUMN game_exception_task_sequences_per_game.next_index IS 'Next index to assign; first reservation returns 1.';
