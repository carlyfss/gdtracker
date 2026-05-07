package com.example.api.controller;

import com.example.api.dto.GameEventTraceCreateRequest;
import com.example.api.dto.GameEventTraceResponse;
import com.example.api.service.TraceIngestService;
import com.example.api.util.IngestHttpSupport;
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

@RestController
@RequestMapping("/api/games/{gameId}/game-trace")
@RequiredArgsConstructor
public class TraceIngestController {

    private final TraceIngestService traceIngestService;

    @PostMapping("/ingest")
    public ResponseEntity<GameEventTraceResponse> ingest(
            @PathVariable("gameId") @NonNull String gameId,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-Player-Id", required = false) String playerId,
            @RequestBody @NonNull GameEventTraceCreateRequest body) {
        String token = IngestHttpSupport.extractBearerToken(authorization);
        String pid = IngestHttpSupport.requirePlayerIdHeader(playerId);
        GameEventTraceResponse response = traceIngestService.ingest(gameId, token, pid, body);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
