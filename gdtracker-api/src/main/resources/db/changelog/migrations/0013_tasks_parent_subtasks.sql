--liquibase formatted sql

--changeset numb-tracker:0013-tasks-add-parent
ALTER TABLE tasks
    ADD COLUMN parent_task_id VARCHAR(36);

--changeset numb-tracker:0013-tasks-parent-fk
ALTER TABLE tasks
    ADD CONSTRAINT fk_tasks_parent FOREIGN KEY (parent_task_id) REFERENCES tasks (id) ON DELETE CASCADE;

--changeset numb-tracker:0013-tasks-parent-index
CREATE INDEX idx_tasks_parent_task_id ON tasks (parent_task_id);
