CREATE TABLE game_exceptions (
    id            VARCHAR(36) PRIMARY KEY,
    error_message VARCHAR(255),
    location      VARCHAR(255),
    map           VARCHAR(255),
    stack_trace   TEXT,
    timestamp     TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_game_exceptions_timestamp ON game_exceptions (timestamp DESC);
