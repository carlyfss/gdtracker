CREATE TABLE features (
    id   VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    CONSTRAINT uk_features_name UNIQUE (name)
);
