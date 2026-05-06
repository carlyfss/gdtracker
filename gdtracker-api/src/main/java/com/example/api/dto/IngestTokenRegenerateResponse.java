package com.example.api.dto;

import java.time.Instant;

public record IngestTokenRegenerateResponse(String token, Instant createdAt) {}
