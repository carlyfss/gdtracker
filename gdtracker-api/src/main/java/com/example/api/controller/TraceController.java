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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games/{gameId}/game-trace")
@RequiredArgsConstructor
public class TraceController {

    private final GameEventTraceRepository gameEventTraceRepository;
    private final GameAccessService gameAccessService;

    @GetMapping
    public ResponseEntity<List<GameEventTraceResponse>> getTraces(
            @PathVariable("gameId") @NonNull String gameId, Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        List<GameEventTraceResponse> response =
                gameEventTraceRepository.findByGameIdOrderByTimestampDesc(gameId).stream()
                        .map(GameEventTraceResponse::fromEntity)
                        .toList();
        return ResponseEntity.ok(response);
    }
}
