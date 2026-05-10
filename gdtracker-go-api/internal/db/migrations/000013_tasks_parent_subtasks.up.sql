ALTER TABLE tasks
    ADD COLUMN parent_task_id VARCHAR(36);

ALTER TABLE tasks
    ADD CONSTRAINT fk_tasks_parent FOREIGN KEY (parent_task_id) REFERENCES tasks (id) ON DELETE CASCADE;

CREATE INDEX idx_tasks_parent_task_id ON tasks (parent_task_id);
