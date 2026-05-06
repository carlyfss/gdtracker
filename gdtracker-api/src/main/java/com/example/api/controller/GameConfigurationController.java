package com.example.api.controller;

import com.example.api.dto.CategorySummaryResponse;
import com.example.api.dto.GameConfigurationPatchRequest;
import com.example.api.dto.GameConfigurationResponse;
import com.example.api.model.Category;
import com.example.api.model.Game;
import com.example.api.model.GameConfiguration;
import com.example.api.repository.CategoryRepository;
import com.example.api.repository.GameConfigurationRepository;
import com.example.api.service.GameAccessService;
import com.example.api.service.GameSetupService;
import jakarta.validation.Valid;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/games/{gameId}/configuration")
@RequiredArgsConstructor
public class GameConfigurationController {

    private final GameConfigurationRepository gameConfigurationRepository;
    private final CategoryRepository categoryRepository;
    private final GameAccessService gameAccessService;
    private final GameSetupService gameSetupService;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<GameConfigurationResponse> getConfiguration(
            @PathVariable("gameId") @NonNull String gameId, Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        Game game = gameAccessService.requireOwnedGame(gameId, userId);
        GameConfiguration configuration = gameConfigurationRepository
                .findByGameId(gameId)
                .orElseGet(() -> {
                    gameSetupService.ensureGameBootstrap(game);
                    return gameConfigurationRepository
                            .findByGameId(gameId)
                            .orElseThrow(() -> new ResponseStatusException(
                                    HttpStatus.INTERNAL_SERVER_ERROR, "configuration bootstrap failed"));
                });
        return ResponseEntity.ok(toResponse(configuration));
    }

    @PatchMapping
    @Transactional
    public ResponseEntity<GameConfigurationResponse> patchConfiguration(
            @PathVariable("gameId") @NonNull String gameId,
            @Valid @RequestBody GameConfigurationPatchRequest req,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        Game game = gameAccessService.requireOwnedGame(gameId, userId);
        GameConfiguration configuration = gameConfigurationRepository
                .findByGameId(gameId)
                .orElseGet(() -> {
                    gameSetupService.ensureGameBootstrap(game);
                    return gameConfigurationRepository
                            .findByGameId(gameId)
                            .orElseThrow(() -> new ResponseStatusException(
                                    HttpStatus.INTERNAL_SERVER_ERROR, "configuration bootstrap failed"));
                });

        configuration.setFeatureFlags(new LinkedHashMap<>(req.featureFlags()));
        configuration.setSettings(new LinkedHashMap<>(sanitizeSettings(req.settings())));

        if (req.defaultExceptionTaskCategoryId() == null
                || req.defaultExceptionTaskCategoryId().isBlank()) {
            configuration.setDefaultExceptionTaskCategory(null);
        } else {
            String categoryId = req.defaultExceptionTaskCategoryId().trim();
            Category category = categoryRepository
                    .findByIdAndGameId(categoryId, gameId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "defaultExceptionTaskCategoryId must reference a game category"));
            configuration.setDefaultExceptionTaskCategory(category);
        }

        GameConfiguration saved = gameConfigurationRepository.save(configuration);
        return ResponseEntity.ok(toResponse(saved));
    }

    private static Map<String, Object> sanitizeSettings(Map<String, Object> raw) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (var e : raw.entrySet()) {
            if (e.getKey() == null || e.getKey().isBlank()) {
                continue;
            }
            Object v = e.getValue();
            if (v == null) {
                continue;
            }
            if (v instanceof String || v instanceof Boolean || v instanceof Number) {
                out.put(e.getKey().trim(), v);
            }
        }
        return out;
    }

    private static GameConfigurationResponse toResponse(GameConfiguration configuration) {
        Category def = configuration.getDefaultExceptionTaskCategory();
        CategorySummaryResponse summary = null;
        String defId = null;
        if (def != null) {
            defId = def.getId();
            summary = new CategorySummaryResponse(def.getId(), def.getName(), def.getColor());
        }
        return new GameConfigurationResponse(
                new LinkedHashMap<>(configuration.getFeatureFlags()),
                new LinkedHashMap<>(configuration.getSettings()),
                defId,
                summary);
    }
}
