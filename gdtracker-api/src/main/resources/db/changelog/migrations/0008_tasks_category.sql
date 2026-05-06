--liquibase formatted sql

--changeset numb-tracker:0008-tasks-add-category-id
ALTER TABLE tasks ADD COLUMN category_id VARCHAR(36);

--changeset numb-tracker:0008-tasks-backfill-category-from-game-config
UPDATE tasks t
SET category_id = gc.default_exception_task_category_id
FROM features fe
JOIN game_configurations gc ON gc.game_id = fe.game_id
WHERE t.feature_id = fe.id
  AND gc.default_exception_task_category_id IS NOT NULL;

--changeset numb-tracker:0008-tasks-fk-category
ALTER TABLE tasks
    ADD CONSTRAINT fk_tasks_category FOREIGN KEY (category_id) REFERENCES categories (id);

--changeset numb-tracker:0008-tasks-category-id-index
CREATE INDEX idx_tasks_category_id ON tasks (category_id);
