package com.example.api.dto;

import com.example.api.model.GameEvent;
import com.example.api.model.GameEventTrace;
import java.time.Instant;

public record GameEventTraceResponse(
        String id,
        String location,
        String map,
        Instant timestamp,
        String gameEventId,
        String renderedMessage,
        String definitionCode,
        String definitionColor) {

    public static GameEventTraceResponse fromEntity(GameEventTrace trace) {
        GameEvent event = trace.getGameEvent();
        String eventId = event != null ? event.getId() : null;
        String renderedMessage = event != null ? event.getRenderedMessage() : null;
        String definitionCode = event != null && event.getDefinition() != null
                ? event.getDefinition().getCode()
                : null;
        String definitionColor = event != null && event.getDefinition() != null
                ? event.getDefinition().getColor()
                : null;
        return new GameEventTraceResponse(
                trace.getId(),
                trace.getLocation(),
                trace.getMap(),
                trace.getTimestamp(),
                eventId,
                renderedMessage,
                definitionCode,
                definitionColor);
    }
}
