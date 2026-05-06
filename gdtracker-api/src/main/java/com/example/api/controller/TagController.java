package com.example.api.controller;

import com.example.api.dto.TagUpsertRequest;
import com.example.api.model.Game;
import com.example.api.model.Tag;
import com.example.api.repository.TagRepository;
import com.example.api.service.GameAccessService;
import com.example.api.util.ColorHex;
import jakarta.validation.Valid;
import java.util.List;
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
@RequestMapping("/api/games/{gameId}/tags")
@RequiredArgsConstructor
public class TagController {

    private final TagRepository tagRepository;
    private final GameAccessService gameAccessService;

    @GetMapping
    public ResponseEntity<List<Tag>> listTags(
            @PathVariable("gameId") @NonNull String gameId, Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        return ResponseEntity.ok(tagRepository.findByGameIdOrderByNameAsc(gameId));
    }

    @PostMapping
    public ResponseEntity<Tag> createTag(
            @PathVariable("gameId") @NonNull String gameId,
            @Valid @RequestBody TagUpsertRequest req,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        Game game = gameAccessService.requireOwnedGame(gameId, userId);
        if (tagRepository.existsByGameIdAndNameIgnoreCase(gameId, req.name())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "tag already exists");
        }
        String color = ColorHex.resolveForCreate(req.color(), Tag.DEFAULT_COLOR);

        Tag tag = new Tag(req.name());
        tag.setColor(color);
        tag.setDescription(req.description());
        tag.setGame(game);

        Tag saved = tagRepository.save(tag);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Tag> updateTag(
            @PathVariable("gameId") @NonNull String gameId,
            @PathVariable("id") @NonNull String id,
            @Valid @RequestBody TagUpsertRequest req,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        Tag existing = tagRepository
                .findByIdAndGameId(id, gameId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "tag not found"));

        tagRepository
                .findByGameIdAndNameIgnoreCase(gameId, req.name())
                .filter(other -> !other.getId().equals(existing.getId()))
                .ifPresent(other -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "tag already exists");
                });

        existing.setName(req.name());
        if (req.color() != null && !req.color().isBlank()) {
            existing.setColor(ColorHex.validate(req.color()));
        }
        existing.setDescription(req.description());

        Tag saved = tagRepository.save(existing);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTag(
            @PathVariable("gameId") @NonNull String gameId,
            @PathVariable("id") @NonNull String id,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        if (tagRepository.findByIdAndGameId(id, gameId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "tag not found");
        }

        try {
            tagRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "tag in use");
        }
    }
}
