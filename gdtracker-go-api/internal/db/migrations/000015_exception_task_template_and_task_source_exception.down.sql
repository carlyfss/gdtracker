DROP INDEX IF EXISTS idx_tasks_source_game_exception_id;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS fk_tasks_source_game_exception;
ALTER TABLE tasks DROP COLUMN IF EXISTS source_game_exception_id;

ALTER TABLE game_configurations ADD COLUMN default_exception_task_category_id VARCHAR(36);

ALTER TABLE game_configurations
    ADD CONSTRAINT fk_game_configurations_default_category FOREIGN KEY (default_exception_task_category_id)
        REFERENCES categories (id) ON DELETE SET NULL;

ALTER TABLE game_configurations DROP COLUMN IF EXISTS exception_task_template;
