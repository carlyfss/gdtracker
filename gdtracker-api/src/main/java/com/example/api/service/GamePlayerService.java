package com.example.api.service;

import com.example.api.model.Game;
import com.example.api.model.GamePlayer;
import com.example.api.repository.GamePlayerRepository;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class GamePlayerService {

    private final GamePlayerRepository gamePlayerRepository;

    @Transactional
    public String registerPlayer(@NonNull Game game) {
        GamePlayer player = new GamePlayer(game);
        return gamePlayerRepository.save(player).getId();
    }

    public GamePlayer requirePlayerForIngest(@NonNull String gameId, @NonNull String playerId) {
        return gamePlayerRepository
                .findByIdAndGame_Id(playerId, gameId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid X-Player-Id"));
    }
}
