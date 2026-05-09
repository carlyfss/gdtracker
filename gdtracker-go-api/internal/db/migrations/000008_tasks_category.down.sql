DROP INDEX IF EXISTS idx_tasks_category_id;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS fk_tasks_category;
ALTER TABLE tasks DROP COLUMN IF EXISTS category_id;
