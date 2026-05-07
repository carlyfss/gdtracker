--liquibase formatted sql

--changeset gdtracker:0022-features-add-archived-at
ALTER TABLE features ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE;

--changeset gdtracker:0022-tasks-add-archived-at
ALTER TABLE tasks ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE;

--changeset gdtracker:0022-archived-features-table
CREATE TABLE archived_features (
    feature_id          VARCHAR(36) PRIMARY KEY,
    archived_at         TIMESTAMP WITH TIME ZONE NOT NULL,
    restored_feature_id VARCHAR(36),
    CONSTRAINT fk_archived_features_feature FOREIGN KEY (feature_id) REFERENCES features (id) ON DELETE CASCADE,
    CONSTRAINT fk_archived_features_restored_feature FOREIGN KEY (restored_feature_id) REFERENCES features (id) ON DELETE SET NULL
);

--changeset gdtracker:0022-archived-tasks-table
CREATE TABLE archived_tasks (
    task_id            VARCHAR(36) PRIMARY KEY,
    archived_at         TIMESTAMP WITH TIME ZONE NOT NULL,
    archived_feature_id VARCHAR(36),
    CONSTRAINT fk_archived_tasks_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT fk_archived_tasks_archived_feature FOREIGN KEY (archived_feature_id) REFERENCES features (id) ON DELETE SET NULL
);

--changeset gdtracker:0022-archive-indexes
CREATE INDEX idx_features_archived_at ON features (archived_at);
CREATE INDEX idx_tasks_archived_at ON tasks (archived_at);
CREATE INDEX idx_archived_features_archived_at ON archived_features (archived_at);
CREATE INDEX idx_archived_tasks_archived_at ON archived_tasks (archived_at);

--changeset gdtracker:0022-backfill-archived-at-from-legacy-booleans
UPDATE features
SET archived_at = NOW()
WHERE archived = TRUE
  AND archived_at IS NULL;

UPDATE tasks
SET archived_at = NOW()
WHERE archived = TRUE
  AND archived_at IS NULL;

--changeset gdtracker:0022-backfill-archive-tables-from-legacy-booleans
INSERT INTO archived_features (feature_id, archived_at, restored_feature_id)
SELECT f.id, f.archived_at, NULL
FROM features f
WHERE f.archived_at IS NOT NULL
ON CONFLICT (feature_id) DO UPDATE SET archived_at = EXCLUDED.archived_at;

INSERT INTO archived_tasks (task_id, archived_at, archived_feature_id)
SELECT t.id,
       t.archived_at,
       CASE
           WHEN f.archived_at IS NOT NULL THEN f.id
           ELSE NULL
       END AS archived_feature_id
FROM tasks t
JOIN features f ON f.id = t.feature_id
WHERE t.archived_at IS NOT NULL
ON CONFLICT (task_id) DO UPDATE SET archived_at = EXCLUDED.archived_at, archived_feature_id = EXCLUDED.archived_feature_id;

