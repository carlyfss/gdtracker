package com.example.api.dto;

import com.example.api.model.GameEvent;
import java.time.Instant;
import java.util.Map;

public record GameEventResponse(
        String id,
        String definitionId,
        String definitionCode,
        String definitionColor,
        String playerId,
        String renderedMessage,
        Map<String, String> payload,
        Instant timestamp) {

    public static GameEventResponse fromEntity(GameEvent e) {
        String playerId = e.getGamePlayer() != null ? e.getGamePlayer().getId() : null;
        return new GameEventResponse(
                e.getId(),
                e.getDefinition().getId(),
                e.getDefinition().getCode(),
                e.getDefinition().getColor(),
                playerId,
                e.getRenderedMessage(),
                e.getPayload(),
                e.getTimestamp());
    }
}
