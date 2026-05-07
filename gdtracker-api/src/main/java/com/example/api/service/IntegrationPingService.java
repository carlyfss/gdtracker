package com.example.api.service;

import com.example.api.model.Game;
import com.example.api.repository.GameRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class IntegrationPingService {

    private final GameIngestTokenService gameIngestTokenService;
    private final GameRepository gameRepository;

    @Transactional
    public void recordPing(String gameId, String bearerToken) {
        Game game = gameIngestTokenService.requireGameForIngestToken(gameId, bearerToken);
        game.setLastIntegrationValidationAt(Instant.now());
        gameRepository.save(game);
    }
}
