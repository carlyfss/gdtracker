CREATE TABLE tasks (
    id          VARCHAR(36) PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    status      VARCHAR(32) NOT NULL,
    feature_id  VARCHAR(36) NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT fk_tasks_feature FOREIGN KEY (feature_id) REFERENCES features (id)
);

CREATE INDEX idx_tasks_feature_id ON tasks (feature_id);
CREATE INDEX idx_tasks_status ON tasks (status);
CREATE INDEX idx_tasks_created_at ON tasks (created_at DESC);
