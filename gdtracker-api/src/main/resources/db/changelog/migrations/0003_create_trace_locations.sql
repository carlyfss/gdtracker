--liquibase formatted sql

--changeset numb-tracker:0003-create-trace-locations
CREATE TABLE trace_locations (
    id        VARCHAR(36) PRIMARY KEY,
    location  VARCHAR(255),
    map       VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);

--changeset numb-tracker:0003-create-trace-locations-indexes
CREATE INDEX idx_trace_locations_timestamp ON trace_locations (timestamp DESC);
