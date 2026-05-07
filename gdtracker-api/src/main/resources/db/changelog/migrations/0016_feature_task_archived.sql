-- liquibase formatted sql

-- changeset gdtracker:0016-feature-task-archived
ALTER TABLE features ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;
