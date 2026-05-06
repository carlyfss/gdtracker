package com.example.api.controller;

import com.example.api.dto.GameEventResponse;
import com.example.api.repository.GameEventRepository;
import com.example.api.service.GameAccessService;
import java.util.List;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games/{gameId}/game-events")
@RequiredArgsConstructor
public class GameEventController {

    private static final int DEFAULT_LIMIT = 200;
    private static final int MAX_LIMIT = 500;

    private final GameEventRepository gameEventRepository;
    private final GameAccessService gameAccessService;

    @GetMapping
    public ResponseEntity<List<GameEventResponse>> listGameEvents(
            @PathVariable("gameId") @NonNull String gameId,
            @RequestParam(value = "q", required = false) String q,
            @RequestParam(value = "code", required = false) String code,
            @RequestParam(value = "limit", required = false) Integer limit,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);

        int effectiveLimit = limit == null ? DEFAULT_LIMIT : Math.min(MAX_LIMIT, Math.max(1, limit));
        String codeParam = code == null || code.isBlank() ? "" : code.trim();
        String qParam = q == null || q.isBlank() ? "" : q.trim();

        return ResponseEntity.ok(
                gameEventRepository
                        .findFilteredForGame(gameId, codeParam, qParam, PageRequest.of(0, effectiveLimit))
                        .stream()
                        .map(GameEventResponse::fromEntity)
                        .toList());
    }
}
