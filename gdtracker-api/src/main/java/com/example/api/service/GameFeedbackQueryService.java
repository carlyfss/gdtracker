package com.example.api.service;

import com.example.api.dto.GameFeedbackDetailResponse;
import com.example.api.dto.GameFeedbackMeterValueResponse;
import com.example.api.dto.GameFeedbackSummaryResponse;
import com.example.api.model.GameFeedback;
import com.example.api.model.GameFeedbackMeterDefinition;
import com.example.api.repository.GameFeedbackMeterDefinitionRepository;
import com.example.api.repository.GameFeedbackRepository;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class GameFeedbackQueryService {

    private final GameFeedbackRepository gameFeedbackRepository;
    private final GameFeedbackMeterDefinitionRepository meterDefinitionRepository;

    @Transactional(readOnly = true)
    public List<GameFeedbackSummaryResponse> listSummaries(@NonNull String gameId) {
        return gameFeedbackRepository.findByGame_IdOrderByCreatedAtDesc(gameId).stream()
                .map(GameFeedbackSummaryResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public GameFeedbackDetailResponse getDetail(@NonNull String gameId, @NonNull String feedbackId) {
        GameFeedback fb = gameFeedbackRepository
                .findByIdAndGame_Id(feedbackId, gameId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "game feedback not found"));

        List<GameFeedbackMeterDefinition> defs =
                meterDefinitionRepository.findByGame_IdOrderBySortOrderAscFieldKeyAsc(gameId);
        Map<String, String> keyToQuestion = new java.util.HashMap<>();
        for (GameFeedbackMeterDefinition d : defs) {
            keyToQuestion.put(d.getFieldKey().toLowerCase(Locale.ROOT), d.getQuestion());
        }

        List<GameFeedbackMeterValueResponse> meters = new ArrayList<>();
        Map<String, Integer> stored = fb.getMeters() == null ? Map.of() : fb.getMeters();
        for (Map.Entry<String, Integer> e : stored.entrySet()) {
            String q = keyToQuestion.getOrDefault(e.getKey().toLowerCase(Locale.ROOT), e.getKey());
            meters.add(new GameFeedbackMeterValueResponse(e.getKey(), q, e.getValue()));
        }
        meters.sort(Comparator.comparing(GameFeedbackMeterValueResponse::fieldKey));

        return new GameFeedbackDetailResponse(
                fb.getId(),
                fb.getTitle(),
                fb.getDescription(),
                fb.getGamePlayer().getId(),
                fb.getCreatedAt(),
                meters);
    }
}
