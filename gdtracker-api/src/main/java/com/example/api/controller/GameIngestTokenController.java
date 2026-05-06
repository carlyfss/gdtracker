package com.example.api.controller;

import com.example.api.dto.IngestTokenRegenerateResponse;
import com.example.api.dto.IngestTokenStatusResponse;
import com.example.api.model.Game;
import com.example.api.service.GameAccessService;
import com.example.api.service.GameIngestTokenService;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games/{gameId}/ingest-token")
@RequiredArgsConstructor
public class GameIngestTokenController {

    private final GameAccessService gameAccessService;
    private final GameIngestTokenService gameIngestTokenService;

    @GetMapping
    public ResponseEntity<IngestTokenStatusResponse> getStatus(
            @PathVariable("gameId") @NonNull String gameId, Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        Game game = gameAccessService.requireOwnedGame(gameId, userId);
        boolean configured = gameIngestTokenService.hasTokenConfigured(game);
        return ResponseEntity.ok(new IngestTokenStatusResponse(configured, game.getIngestTokenCreatedAt()));
    }

    @PostMapping("/regenerate")
    public ResponseEntity<IngestTokenRegenerateResponse> regenerate(
            @PathVariable("gameId") @NonNull String gameId, Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        Game game = gameAccessService.requireOwnedGame(gameId, userId);
        String plaintext = gameIngestTokenService.regenerateToken(game);
        return ResponseEntity.ok(new IngestTokenRegenerateResponse(plaintext, game.getIngestTokenCreatedAt()));
    }
}
