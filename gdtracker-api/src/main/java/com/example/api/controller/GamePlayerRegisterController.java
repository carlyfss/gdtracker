package com.example.api.controller;

import com.example.api.dto.GamePlayerRegisterResponse;
import com.example.api.model.Game;
import com.example.api.service.GameIngestTokenService;
import com.example.api.service.GamePlayerService;
import com.example.api.util.IngestHttpSupport;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games/{gameId}/game-players")
@RequiredArgsConstructor
public class GamePlayerRegisterController {

    private final GameIngestTokenService gameIngestTokenService;
    private final GamePlayerService gamePlayerService;

    @PostMapping
    public ResponseEntity<GamePlayerRegisterResponse> register(
            @PathVariable("gameId") @NonNull String gameId,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        String token = IngestHttpSupport.extractBearerToken(authorization);
        Game game = gameIngestTokenService.requireGameForIngestToken(gameId, token);
        String playerId = gamePlayerService.registerPlayer(game);
        return ResponseEntity.status(HttpStatus.CREATED).body(new GamePlayerRegisterResponse(playerId));
    }
}
