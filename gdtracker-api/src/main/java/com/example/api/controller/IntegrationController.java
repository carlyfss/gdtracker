package com.example.api.controller;

import com.example.api.dto.IntegrationPingRequest;
import com.example.api.dto.IntegrationStatusResponse;
import com.example.api.model.Game;
import com.example.api.service.GameAccessService;
import com.example.api.service.IntegrationPingService;
import com.example.api.util.IngestHttpSupport;
import jakarta.validation.Valid;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games/{gameId}/integration")
@RequiredArgsConstructor
public class IntegrationController {

    private final IntegrationPingService integrationPingService;
    private final GameAccessService gameAccessService;

    /**
     * Bearer ingest token only — verifies connectivity without registering a player or posting events.
     */
    @PostMapping
    public ResponseEntity<Void> ping(
            @PathVariable("gameId") @NonNull String gameId,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody IntegrationPingRequest body) {
        String token = IngestHttpSupport.extractBearerToken(authorization);
        integrationPingService.recordPing(gameId, token);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/status")
    public ResponseEntity<IntegrationStatusResponse> status(
            @PathVariable("gameId") @NonNull String gameId, Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        Game game = gameAccessService.requireOwnedGame(gameId, userId);
        return ResponseEntity.ok(new IntegrationStatusResponse(game.getLastIntegrationValidationAt()));
    }
}
