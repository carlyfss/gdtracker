--liquibase formatted sql

--changeset numb-tracker:0018-last-integration-validation
ALTER TABLE games
    ADD COLUMN last_integration_validation_at TIMESTAMPTZ;
