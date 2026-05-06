--liquibase formatted sql

--changeset numb-tracker:0005-alter-features-rich
ALTER TABLE features ADD COLUMN description TEXT;
ALTER TABLE features ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'TODO';
ALTER TABLE features ADD COLUMN color VARCHAR(7) NOT NULL DEFAULT '#818cf8';
