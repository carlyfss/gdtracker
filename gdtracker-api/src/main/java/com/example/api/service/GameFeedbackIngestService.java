package com.example.api.service;

import com.example.api.dto.GameFeedbackIngestRequest;
import com.example.api.model.Game;
import com.example.api.model.GameFeedback;
import com.example.api.model.GameFeedbackMeterDefinition;
import com.example.api.model.GamePlayer;
import com.example.api.repository.GameFeedbackMeterDefinitionRepository;
import com.example.api.repository.GameFeedbackRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class GameFeedbackIngestService {

    private static final int METER_MIN = 1;
    private static final int METER_MAX = 10;

    private final GameIngestTokenService gameIngestTokenService;
    private final GamePlayerService gamePlayerService;
    private final GameFeedbackMeterDefinitionRepository meterDefinitionRepository;
    private final GameFeedbackRepository gameFeedbackRepository;

    @Transactional
    public GameFeedback ingest(String gameId, String bearerToken, String playerId, GameFeedbackIngestRequest request) {
        if (!StringUtils.hasText(request.title())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "title is required");
        }
        if (!StringUtils.hasText(request.description())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "description is required");
        }
        Game game = gameIngestTokenService.requireGameForIngestToken(gameId, bearerToken);
        GamePlayer player = gamePlayerService.requirePlayerForIngest(gameId, playerId);

        List<GameFeedbackMeterDefinition> definitions =
                meterDefinitionRepository.findByGame_IdOrderBySortOrderAscFieldKeyAsc(gameId);
        Map<String, Integer> canonicalMeters = validateAndCanonicalizeMeters(definitions, request.meters());

        GameFeedback fb = new GameFeedback();
        fb.setGame(game);
        fb.setGamePlayer(player);
        fb.setTitle(request.title());
        fb.setDescription(request.description());
        fb.setMeters(new HashMap<>(canonicalMeters));
        return gameFeedbackRepository.save(fb);
    }

    private static Map<String, Integer> validateAndCanonicalizeMeters(
            List<GameFeedbackMeterDefinition> definitions, Map<String, Integer> rawMeters) {
        if (definitions.isEmpty()) {
            if (rawMeters != null && !rawMeters.isEmpty()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "meters must be empty when no feedback template is configured");
            }
            return Map.of();
        }

        Map<String, Integer> input = rawMeters == null ? Map.of() : rawMeters;
        Map<String, Integer> lowerKeyToValue = new HashMap<>();
        for (Map.Entry<String, Integer> e : input.entrySet()) {
            if (e.getKey() == null || e.getKey().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "meter keys must be non-blank");
            }
            String lower = e.getKey().trim().toLowerCase(Locale.ROOT);
            if (lowerKeyToValue.containsKey(lower)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "duplicate meter key in request");
            }
            lowerKeyToValue.put(lower, e.getValue());
        }

        Map<String, Integer> out = new HashMap<>();
        for (GameFeedbackMeterDefinition def : definitions) {
            String defLower = def.getFieldKey().toLowerCase(Locale.ROOT);
            Integer value = lowerKeyToValue.remove(defLower);
            if (value == null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "missing meter value for field: " + def.getFieldKey());
            }
            if (value < METER_MIN || value > METER_MAX) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "meter value for " + def.getFieldKey() + " must be between " + METER_MIN + " and " + METER_MAX);
            }
            out.put(def.getFieldKey(), value);
        }

        if (!lowerKeyToValue.isEmpty()) {
            String unknown = lowerKeyToValue.keySet().iterator().next();
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unknown meter key: " + unknown);
        }

        return out;
    }
}
