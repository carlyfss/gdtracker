package com.example.api.controller;

import com.example.api.dto.CategoryUpsertRequest;
import com.example.api.model.Category;
import com.example.api.model.Game;
import com.example.api.repository.CategoryRepository;
import com.example.api.repository.TaskRepository;
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
@RequestMapping("/api/games/{gameId}/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryRepository categoryRepository;
    private final TaskRepository taskRepository;
    private final GameAccessService gameAccessService;

    @GetMapping
    public ResponseEntity<List<Category>> listCategories(
            @PathVariable("gameId") @NonNull String gameId, Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        return ResponseEntity.ok(categoryRepository.findByGameIdOrderByNameAsc(gameId));
    }

    @PostMapping
    public ResponseEntity<Category> createCategory(
            @PathVariable("gameId") @NonNull String gameId,
            @Valid @RequestBody CategoryUpsertRequest req,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        Game game = gameAccessService.requireOwnedGame(gameId, userId);
        if (categoryRepository.existsByGameIdAndNameIgnoreCase(gameId, req.name())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "category already exists");
        }
        String color = ColorHex.resolveForCreate(req.color(), Category.DEFAULT_COLOR);

        Category category = new Category(req.name());
        category.setColor(color);
        category.setGame(game);

        Category saved = categoryRepository.save(category);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Category> updateCategory(
            @PathVariable("gameId") @NonNull String gameId,
            @PathVariable("id") @NonNull String id,
            @Valid @RequestBody CategoryUpsertRequest req,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        Category existing = categoryRepository
                .findByIdAndGameId(id, gameId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "category not found"));

        categoryRepository
                .findByGameIdAndNameIgnoreCase(gameId, req.name())
                .filter(other -> !other.getId().equals(existing.getId()))
                .ifPresent(other -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "category already exists");
                });

        existing.setName(req.name());
        if (req.color() != null && !req.color().isBlank()) {
            existing.setColor(ColorHex.validate(req.color()));
        }

        Category saved = categoryRepository.save(existing);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCategory(
            @PathVariable("gameId") @NonNull String gameId,
            @PathVariable("id") @NonNull String id,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        if (categoryRepository.findByIdAndGameId(id, gameId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "category not found");
        }

        if (taskRepository.existsByCategoryId(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "category has tasks");
        }

        try {
            categoryRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "category in use");
        }
    }
}
