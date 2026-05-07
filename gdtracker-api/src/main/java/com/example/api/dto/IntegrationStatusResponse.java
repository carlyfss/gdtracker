package com.example.api.dto;

import java.time.Instant;

public record IntegrationStatusResponse(Instant lastValidatedAt) {}
