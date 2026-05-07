package com.example.api.controller;

import com.example.api.dto.GameFeedbackMeterDefinitionUpsertRequest;
import com.example.api.model.Game;
import com.example.api.model.GameFeedbackMeterDefinition;
import com.example.api.repository.GameFeedbackMeterDefinitionRepository;
import com.example.api.service.GameAccessService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.regex.Pattern;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/games/{gameId}/game-feedback-meter-definitions")
@RequiredArgsConstructor
public class GameFeedbackMeterDefinitionController {

    private static final Pattern CODE_PATTERN = Pattern.compile("^[a-z0-9][a-z0-9_\\-]*$");

    private final GameFeedbackMeterDefinitionRepository meterDefinitionRepository;
    private final GameAccessService gameAccessService;

    @GetMapping
    public ResponseEntity<List<GameFeedbackMeterDefinition>> list(
            @PathVariable("gameId") @NonNull String gameId, Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        return ResponseEntity.ok(meterDefinitionRepository.findByGame_IdOrderBySortOrderAscFieldKeyAsc(gameId));
    }

    @PostMapping
    public ResponseEntity<GameFeedbackMeterDefinition> create(
            @PathVariable("gameId") @NonNull String gameId,
            @Valid @RequestBody GameFeedbackMeterDefinitionUpsertRequest req,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        Game game = gameAccessService.requireOwnedGame(gameId, userId);
        validateFieldKey(req.fieldKey());
        if (meterDefinitionRepository.existsByGame_IdAndFieldKeyIgnoreCase(gameId, req.fieldKey())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "feedback meter field key already exists");
        }
        GameFeedbackMeterDefinition def =
                new GameFeedbackMeterDefinition(req.fieldKey(), req.question(), req.sortOrder(), game);
        GameFeedbackMeterDefinition saved = meterDefinitionRepository.save(def);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<GameFeedbackMeterDefinition> update(
            @PathVariable("gameId") @NonNull String gameId,
            @PathVariable("id") @NonNull String id,
            @Valid @RequestBody GameFeedbackMeterDefinitionUpsertRequest req,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        validateFieldKey(req.fieldKey());

        GameFeedbackMeterDefinition existing = meterDefinitionRepository
                .findByIdAndGame_Id(id, gameId)
                .orElseThrow(
                        () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "feedback meter definition not found"));

        meterDefinitionRepository
                .findByGame_IdAndFieldKeyIgnoreCase(gameId, req.fieldKey())
                .filter(other -> !other.getId().equals(existing.getId()))
                .ifPresent(other -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "feedback meter field key already exists");
                });

        existing.setFieldKey(req.fieldKey());
        existing.setQuestion(req.question());
        existing.setSortOrder(req.sortOrder());
        return ResponseEntity.ok(meterDefinitionRepository.save(existing));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable("gameId") @NonNull String gameId,
            @PathVariable("id") @NonNull String id,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        if (meterDefinitionRepository.findByIdAndGame_Id(id, gameId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "feedback meter definition not found");
        }
        meterDefinitionRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private static void validateFieldKey(String fieldKey) {
        if (fieldKey == null || fieldKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "fieldKey is required");
        }
        if (!CODE_PATTERN.matcher(fieldKey).matches()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "fieldKey must start with a letter or digit and contain only a-z, 0-9, _, -");
        }
    }
}
