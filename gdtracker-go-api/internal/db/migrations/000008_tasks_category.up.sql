ALTER TABLE tasks ADD COLUMN category_id VARCHAR(36);

UPDATE tasks t
SET category_id = gc.default_exception_task_category_id
FROM features fe
JOIN game_configurations gc ON gc.game_id = fe.game_id
WHERE t.feature_id = fe.id
  AND gc.default_exception_task_category_id IS NOT NULL;

ALTER TABLE tasks
    ADD CONSTRAINT fk_tasks_category FOREIGN KEY (category_id) REFERENCES categories (id);

CREATE INDEX idx_tasks_category_id ON tasks (category_id);
