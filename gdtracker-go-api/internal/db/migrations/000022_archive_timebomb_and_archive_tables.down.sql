DELETE FROM archived_tasks;
DELETE FROM archived_features;

DROP INDEX IF EXISTS idx_archived_tasks_archived_at;
DROP INDEX IF EXISTS idx_archived_features_archived_at;
DROP INDEX IF EXISTS idx_tasks_archived_at;
DROP INDEX IF EXISTS idx_features_archived_at;

DROP TABLE IF EXISTS archived_tasks CASCADE;
DROP TABLE IF EXISTS archived_features CASCADE;

ALTER TABLE tasks DROP COLUMN IF EXISTS archived_at;
ALTER TABLE features DROP COLUMN IF EXISTS archived_at;
