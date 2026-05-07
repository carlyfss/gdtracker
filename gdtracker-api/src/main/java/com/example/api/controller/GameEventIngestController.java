package com.example.api.controller;

import com.example.api.dto.GameEventIngestRequest;
import com.example.api.dto.GameEventResponse;
import com.example.api.model.GameEvent;
import com.example.api.service.GameEventIngestService;
import com.example.api.util.IngestHttpSupport;
import jakarta.validation.Valid;
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
@RequestMapping("/api/games/{gameId}/game-events")
@RequiredArgsConstructor
public class GameEventIngestController {

    private final GameEventIngestService gameEventIngestService;

    @PostMapping("/ingest")
    public ResponseEntity<GameEventResponse> ingest(
            @PathVariable("gameId") @NonNull String gameId,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestHeader(value = "X-Player-Id", required = false) String playerId,
            @Valid @RequestBody GameEventIngestRequest body) {
        String token = IngestHttpSupport.extractBearerToken(authorization);
        String pid = IngestHttpSupport.requirePlayerIdHeader(playerId);
        GameEvent saved = gameEventIngestService.ingest(gameId, token, pid, body);
        return ResponseEntity.status(HttpStatus.CREATED).body(GameEventResponse.fromEntity(saved));
    }
}
