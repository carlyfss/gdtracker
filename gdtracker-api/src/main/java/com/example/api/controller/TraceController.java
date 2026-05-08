package com.example.api.controller;

import com.example.api.dto.GameEventTraceResponse;
import com.example.api.repository.GameEventTraceRepository;
import com.example.api.service.GameAccessService;
import java.util.List;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games/{gameId}/game-trace")
@RequiredArgsConstructor
public class TraceController {

    private final GameEventTraceRepository gameEventTraceRepository;
    private final GameAccessService gameAccessService;

    @GetMapping
    public ResponseEntity<List<GameEventTraceResponse>> getTraces(
            @PathVariable("gameId") @NonNull String gameId,
            @RequestParam(value = "playerId", required = false) String playerId,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        String playerIdParam = playerId == null || playerId.isBlank() ? "" : playerId.trim();
        List<GameEventTraceResponse> response = (playerIdParam.isEmpty()
                        ? gameEventTraceRepository.findByGameIdOrderByTimestampDesc(gameId)
                        : gameEventTraceRepository.findByGameIdAndGamePlayer_IdOrderByTimestampDesc(
                                gameId, playerIdParam))
                .stream().map(GameEventTraceResponse::fromEntity).toList();
        return ResponseEntity.ok(response);
    }
}
