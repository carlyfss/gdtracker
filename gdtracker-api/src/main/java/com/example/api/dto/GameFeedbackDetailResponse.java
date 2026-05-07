package com.example.api.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.Instant;
import java.util.List;

public record GameFeedbackDetailResponse(
        String id,
        String title,
        String description,
        String playerId,
        @JsonFormat(shape = JsonFormat.Shape.STRING) Instant createdAt,
        List<GameFeedbackMeterValueResponse> meters) {}
