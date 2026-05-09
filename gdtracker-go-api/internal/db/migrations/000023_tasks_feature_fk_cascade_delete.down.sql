ALTER TABLE tasks DROP CONSTRAINT IF EXISTS fk_tasks_feature;
ALTER TABLE tasks
    ADD CONSTRAINT fk_tasks_feature FOREIGN KEY (feature_id) REFERENCES features (id);
