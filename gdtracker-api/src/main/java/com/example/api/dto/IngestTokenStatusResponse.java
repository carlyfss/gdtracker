package com.example.api.dto;

import java.time.Instant;

public record IngestTokenStatusResponse(boolean configured, Instant createdAt) {}
