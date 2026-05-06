package com.example.api.dto;

public record GameEventTraceCreateRequest(String location, String map, String gameEventId) {

    public GameEventTraceCreateRequest {
        location = location != null ? location.trim() : null;
        map = map != null ? map.trim() : null;
        gameEventId = gameEventId != null && !gameEventId.isBlank() ? gameEventId.trim() : null;
    }
}
