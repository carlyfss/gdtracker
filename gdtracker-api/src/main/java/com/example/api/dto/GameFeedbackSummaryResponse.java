package com.example.api.dto;

import com.example.api.model.GameFeedback;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.Instant;

public record GameFeedbackSummaryResponse(
        String id, String title, String playerId, @JsonFormat(shape = JsonFormat.Shape.STRING) Instant createdAt) {

    public static GameFeedbackSummaryResponse fromEntity(GameFeedback entity) {
        return new GameFeedbackSummaryResponse(
                entity.getId(), entity.getTitle(), entity.getGamePlayer().getId(), entity.getCreatedAt());
    }
}
