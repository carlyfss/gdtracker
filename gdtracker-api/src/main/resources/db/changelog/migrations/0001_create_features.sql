--liquibase formatted sql

--changeset numb-tracker:0001-create-features
CREATE TABLE features (
    id   VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    CONSTRAINT uk_features_name UNIQUE (name)
);
