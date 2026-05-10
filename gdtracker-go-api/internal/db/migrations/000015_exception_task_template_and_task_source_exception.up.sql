ALTER TABLE game_configurations ADD COLUMN exception_task_template JSONB;

UPDATE game_configurations
SET exception_task_template = jsonb_build_object(
    'titleTemplate', 'Fix Exception #<EXCEPTION_INDEX>',
    'descriptionTemplate', E'```\n<EXCEPTION_TRACE>\n```',
    'defaultCategoryId', default_exception_task_category_id
);

ALTER TABLE game_configurations ALTER COLUMN exception_task_template SET NOT NULL;

ALTER TABLE game_configurations
    ALTER COLUMN exception_task_template SET DEFAULT '{"titleTemplate":"Fix Exception #<EXCEPTION_INDEX>","descriptionTemplate":"```\n<EXCEPTION_TRACE>\n```","defaultCategoryId":null}'::jsonb;

ALTER TABLE game_configurations DROP CONSTRAINT fk_game_configurations_default_category;

ALTER TABLE game_configurations DROP COLUMN default_exception_task_category_id;

ALTER TABLE tasks ADD COLUMN source_game_exception_id VARCHAR(36);

ALTER TABLE tasks
    ADD CONSTRAINT fk_tasks_source_game_exception FOREIGN KEY (source_game_exception_id) REFERENCES game_exceptions (id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_source_game_exception_id ON tasks (source_game_exception_id);
