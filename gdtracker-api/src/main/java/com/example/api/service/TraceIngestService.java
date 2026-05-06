package com.example.api.service;

import com.example.api.dto.GameEventTraceCreateRequest;
import com.example.api.dto.GameEventTraceResponse;
import com.example.api.model.Game;
import com.example.api.model.GameEvent;
import com.example.api.model.GameEventTrace;
import com.example.api.repository.GameEventRepository;
import com.example.api.repository.GameEventTraceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class TraceIngestService {

    private final GameIngestTokenService gameIngestTokenService;
    private final GameEventTraceRepository gameEventTraceRepository;
    private final GameEventRepository gameEventRepository;

    @Transactional
    public GameEventTraceResponse ingest(String gameId, String bearerToken, GameEventTraceCreateRequest request) {
        Game game = gameIngestTokenService.requireGameForIngestToken(gameId, bearerToken);

        GameEventTrace trace = new GameEventTrace(request.location(), request.map());
        trace.setGame(game);

        String eventId = request.gameEventId();
        if (eventId != null) {
            GameEvent event = gameEventRepository
                    .findById(eventId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "game event not found"));
            if (event.getGame() == null || !gameId.equals(event.getGame().getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "game event does not belong to this game");
            }
            trace.setGameEvent(event);
        }

        GameEventTrace saved = gameEventTraceRepository.save(trace);
        return GameEventTraceResponse.fromEntity(saved);
    }
}
