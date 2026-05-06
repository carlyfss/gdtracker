package com.example.api.controller;

import com.example.api.dto.GameEventDefinitionUpsertRequest;
import com.example.api.model.Feature;
import com.example.api.model.Game;
import com.example.api.model.GameEventDefinition;
import com.example.api.repository.GameEventDefinitionRepository;
import com.example.api.repository.GameEventRepository;
import com.example.api.service.GameAccessService;
import com.example.api.service.GameEventImageService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.regex.Pattern;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
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
@RequestMapping("/api/games/{gameId}/game-event-definitions")
@RequiredArgsConstructor
public class GameEventDefinitionController {

    private static final Pattern CODE_PATTERN = Pattern.compile("^[a-z0-9][a-z0-9_\\-]*$");
    private static final Pattern COLOR_HEX = Pattern.compile("#[0-9A-Fa-f]{6}");

    private final GameEventDefinitionRepository definitionRepository;
    private final GameEventRepository gameEventRepository;
    private final GameAccessService gameAccessService;
    private final GameEventImageService gameEventImageService;

    @GetMapping
    public ResponseEntity<List<GameEventDefinition>> listDefinitions(
            @PathVariable("gameId") @NonNull String gameId, Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        return ResponseEntity.ok(definitionRepository.findByGame_IdOrderByCodeAsc(gameId));
    }

    @PostMapping
    public ResponseEntity<GameEventDefinition> createDefinition(
            @PathVariable("gameId") @NonNull String gameId,
            @Valid @RequestBody GameEventDefinitionUpsertRequest req,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        Game game = gameAccessService.requireOwnedGame(gameId, userId);
        validateCode(req.code());
        if (definitionRepository.existsByGame_IdAndCodeIgnoreCase(gameId, req.code())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "game event definition code already exists");
        }
        gameEventImageService.validateOptionalImageData(req.imageData());

        GameEventDefinition def = new GameEventDefinition(req.code(), req.messageTemplate(), game);
        def.setDisplayName(req.displayName());
        def.setImageData(req.imageData());
        def.setColor(resolveColorForCreate(req.color()));

        GameEventDefinition saved = definitionRepository.save(def);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<GameEventDefinition> updateDefinition(
            @PathVariable("gameId") @NonNull String gameId,
            @PathVariable("id") @NonNull String id,
            @Valid @RequestBody GameEventDefinitionUpsertRequest req,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        validateCode(req.code());

        GameEventDefinition existing = definitionRepository
                .findByIdAndGame_Id(id, gameId)
                .orElseThrow(
                        () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "game event definition not found"));

        definitionRepository
                .findByGame_IdAndCodeIgnoreCase(gameId, req.code())
                .filter(other -> !other.getId().equals(existing.getId()))
                .ifPresent(other -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "game event definition code already exists");
                });

        gameEventImageService.validateOptionalImageData(req.imageData());

        existing.setCode(req.code());
        existing.setDisplayName(req.displayName());
        existing.setMessageTemplate(req.messageTemplate());
        existing.setImageData(req.imageData());
        if (req.color() != null && !req.color().isBlank()) {
            existing.setColor(validateColor(req.color().trim()));
        }

        GameEventDefinition saved = definitionRepository.save(existing);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDefinition(
            @PathVariable("gameId") @NonNull String gameId,
            @PathVariable("id") @NonNull String id,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        if (definitionRepository.findByIdAndGame_Id(id, gameId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "game event definition not found");
        }
        if (gameEventRepository.existsByDefinition_Id(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "game event definition has recorded events");
        }
        try {
            definitionRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "game event definition has recorded events");
        }
    }

    private static String resolveColorForCreate(String raw) {
        if (raw == null || raw.isBlank()) {
            return Feature.DEFAULT_COLOR;
        }
        return validateColor(raw.trim());
    }

    private static String validateColor(String value) {
        if (!COLOR_HEX.matcher(value).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "color must be a #RRGGBB hex value");
        }
        return value.toLowerCase();
    }

    private static void validateCode(String code) {
        if (code == null || code.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "code is required");
        }
        if (!CODE_PATTERN.matcher(code).matches()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "code must start with a letter or digit and contain only a-z, 0-9, _, -");
        }
    }
}
