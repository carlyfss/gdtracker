package com.example.api.service;

import com.example.api.dto.GameEventIngestRequest;
import com.example.api.model.Game;
import com.example.api.model.GameEvent;
import com.example.api.model.GameEventDefinition;
import com.example.api.model.GameEventTrace;
import com.example.api.repository.GameEventDefinitionRepository;
import com.example.api.repository.GameEventRepository;
import com.example.api.repository.GameEventTraceRepository;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class GameEventIngestService {

    private static final Logger log = LoggerFactory.getLogger(GameEventIngestService.class);

    // Payload keys are normalized to uppercase by GameEventTemplateService.normalizeKeys.
    // Client-facing convention is the lowercase keys "location" and "map" in the ingest parameters.
    private static final String LOCATION_KEY = "LOCATION";
    private static final String MAP_KEY = "MAP";

    private final GameIngestTokenService gameIngestTokenService;
    private final GameEventDefinitionRepository definitionRepository;
    private final GameEventRepository gameEventRepository;
    private final GameEventTraceRepository gameEventTraceRepository;
    private final GameEventTemplateService templateService;

    @Transactional
    public GameEvent ingest(String gameId, String bearerToken, GameEventIngestRequest request) {
        Game game = gameIngestTokenService.requireGameForIngestToken(gameId, bearerToken);
        GameEventDefinition def = definitionRepository
                .findByGame_IdAndCodeIgnoreCase(gameId, request.definitionCode())
                .orElseThrow(
                        () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "game event definition not found"));

        Map<String, String> payload = templateService.normalizeKeys(request.parameters());
        String rendered = templateService.render(def.getMessageTemplate(), payload);

        GameEvent event = new GameEvent();
        event.setGame(game);
        event.setDefinition(def);
        event.setRenderedMessage(rendered);
        event.setPayload(new HashMap<>(payload));
        GameEvent saved = gameEventRepository.save(event);

        autoCreateTrace(game, saved, payload);

        return saved;
    }

    private void autoCreateTrace(Game game, GameEvent event, Map<String, String> payload) {
        String location = payload.get(LOCATION_KEY);
        String map = payload.get(MAP_KEY);
        if (location == null || location.isBlank() || map == null || map.isBlank()) {
            return;
        }
        try {
            GameEventTrace trace = new GameEventTrace(location, map);
            trace.setGame(game);
            trace.setGameEvent(event);
            gameEventTraceRepository.save(trace);
        } catch (RuntimeException ex) {
            log.warn("failed to auto-create GameEventTrace for event {}: {}", event.getId(), ex.getMessage());
        }
    }
}
