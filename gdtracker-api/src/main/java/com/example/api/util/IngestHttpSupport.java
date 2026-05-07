package com.example.api.util;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class IngestHttpSupport {

    private IngestHttpSupport() {}

    public static String extractBearerToken(String authorization) {
        if (authorization == null || authorization.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "missing Authorization Bearer token");
        }
        String trimmed = authorization.trim();
        if (!trimmed.regionMatches(true, 0, "Bearer ", 0, 7)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authorization must use Bearer scheme");
        }
        String token = trimmed.substring(7).trim();
        if (token.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "missing Bearer token");
        }
        return token;
    }

    /**
     * Ingest player identity sent by the game (header {@code X-Player-Id}).
     */
    public static String requirePlayerIdHeader(String xPlayerId) {
        if (xPlayerId == null || xPlayerId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "missing X-Player-Id");
        }
        return xPlayerId.trim();
    }
}
