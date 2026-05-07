--liquibase formatted sql

--changeset numb-tracker:0020-game-exceptions-short-error-message
ALTER TABLE game_exceptions ADD COLUMN short_error_message VARCHAR(255);
