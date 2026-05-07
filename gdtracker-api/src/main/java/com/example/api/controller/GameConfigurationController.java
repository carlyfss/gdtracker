package com.example.api.controller;

import com.example.api.dto.CategorySummaryResponse;
import com.example.api.dto.ExceptionTaskTemplatePatch;
import com.example.api.dto.ExceptionTaskTemplateResponse;
import com.example.api.dto.GameConfigurationPatchRequest;
import com.example.api.dto.GameConfigurationResponse;
import com.example.api.model.Category;
import com.example.api.model.ExceptionTaskTemplate;
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
        return ResponseEntity.ok(toResponse(configuration, gameId));
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

        if (req.exceptionTaskTemplate() != null) {
            applyExceptionTaskTemplatePatch(configuration, req.exceptionTaskTemplate(), gameId);
        }

        GameConfiguration saved = gameConfigurationRepository.save(configuration);
        return ResponseEntity.ok(toResponse(saved, gameId));
    }

    private void applyExceptionTaskTemplatePatch(
            GameConfiguration configuration, ExceptionTaskTemplatePatch p, String gameId) {
        String title = p.titleTemplate() == null || p.titleTemplate().isBlank()
                ? ExceptionTaskTemplate.DEFAULT_TITLE_TEMPLATE
                : p.titleTemplate().trim();
        String desc = p.descriptionTemplate() == null || p.descriptionTemplate().isBlank()
                ? ExceptionTaskTemplate.DEFAULT_DESCRIPTION_TEMPLATE
                : p.descriptionTemplate();
        String catRaw = p.defaultCategoryId();
        String categoryId = null;
        if (catRaw != null && !catRaw.isBlank()) {
            categoryRepository
                    .findByIdAndGameId(catRaw.trim(), gameId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "exceptionTaskTemplate.defaultCategoryId must reference a category"));
            categoryId = catRaw.trim();
        }
        ExceptionTaskTemplate t = new ExceptionTaskTemplate();
        t.setTitleTemplate(title);
        t.setDescriptionTemplate(desc);
        t.setDefaultCategoryId(categoryId);
        configuration.setExceptionTaskTemplate(t);
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

    private GameConfigurationResponse toResponse(GameConfiguration configuration, String gameId) {
        ExceptionTaskTemplate raw = configuration.getExceptionTaskTemplate();
        if (raw == null) {
            raw = ExceptionTaskTemplate.withDefaults(null);
        }
        String title = raw.getTitleTemplate() == null || raw.getTitleTemplate().isBlank()
                ? ExceptionTaskTemplate.DEFAULT_TITLE_TEMPLATE
                : raw.getTitleTemplate();
        String desc = raw.getDescriptionTemplate() == null
                        || raw.getDescriptionTemplate().isBlank()
                ? ExceptionTaskTemplate.DEFAULT_DESCRIPTION_TEMPLATE
                : raw.getDescriptionTemplate();
        String defId = raw.getDefaultCategoryId();
        if (defId != null && defId.isBlank()) {
            defId = null;
        }
        CategorySummaryResponse summary = null;
        if (defId != null) {
            Category def = categoryRepository.findByIdAndGameId(defId, gameId).orElse(null);
            if (def != null) {
                summary = new CategorySummaryResponse(def.getId(), def.getName(), def.getColor());
            }
        }
        ExceptionTaskTemplateResponse templateResponse = new ExceptionTaskTemplateResponse(title, desc, defId, summary);
        return new GameConfigurationResponse(
                new LinkedHashMap<>(configuration.getFeatureFlags()),
                new LinkedHashMap<>(configuration.getSettings()),
                templateResponse);
    }
}
