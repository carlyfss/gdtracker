package com.example.api.service;

import com.example.api.dto.GameExceptionIngestRequest;
import com.example.api.model.Game;
import com.example.api.model.GameException;
import com.example.api.model.GamePlayer;
import com.example.api.repository.GameExceptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GameExceptionIngestService {

    private final GameIngestTokenService gameIngestTokenService;
    private final GamePlayerService gamePlayerService;
    private final GameExceptionRepository gameExceptionRepository;

    @Transactional
    public GameException ingest(
            String gameId, String bearerToken, String playerId, GameExceptionIngestRequest request) {
        Game game = gameIngestTokenService.requireGameForIngestToken(gameId, bearerToken);
        GamePlayer player = gamePlayerService.requirePlayerForIngest(gameId, playerId);

        GameException ex = new GameException(request.errorMessage(), request.location(), request.map());
        ex.setShortErrorMessage(request.shortErrorMessage());
        ex.setStackTrace(request.stackTrace());
        ex.setGame(game);
        ex.setGamePlayer(player);
        return gameExceptionRepository.save(ex);
    }
}
