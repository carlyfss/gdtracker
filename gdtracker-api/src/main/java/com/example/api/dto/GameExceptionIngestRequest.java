package com.example.api.dto;

public record GameExceptionIngestRequest(
        String errorMessage, String location, String map, String stackTrace, String shortErrorMessage) {

    public GameExceptionIngestRequest {
        errorMessage = normalizeNullable(errorMessage);
        location = normalizeNullable(location);
        map = normalizeNullable(map);
        stackTrace = normalizeNullable(stackTrace);
        shortErrorMessage = normalizeNullable(shortErrorMessage);
    }

    private static String normalizeNullable(String raw) {
        if (raw == null) {
            return null;
        }
        String t = raw.trim();
        return t.isEmpty() ? null : t;
    }
}
