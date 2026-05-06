package com.example.api.controller;

import com.example.api.dto.GameEventTraceCreateRequest;
import com.example.api.dto.GameEventTraceResponse;
import com.example.api.service.TraceIngestService;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/games/{gameId}/game-trace")
@RequiredArgsConstructor
public class TraceIngestController {

    private final TraceIngestService traceIngestService;

    @PostMapping("/ingest")
    public ResponseEntity<GameEventTraceResponse> ingest(
            @PathVariable("gameId") @NonNull String gameId,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody @NonNull GameEventTraceCreateRequest body) {
        String token = extractBearerToken(authorization);
        GameEventTraceResponse response = traceIngestService.ingest(gameId, token, body);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    private static String extractBearerToken(String authorization) {
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
}
