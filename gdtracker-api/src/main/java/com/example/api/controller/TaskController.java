package com.example.api.controller;

import com.example.api.dto.TaskUpsertRequest;
import com.example.api.model.Category;
import com.example.api.model.Feature;
import com.example.api.model.Tag;
import com.example.api.model.Task;
import com.example.api.model.TaskStatus;
import com.example.api.repository.CategoryRepository;
import com.example.api.repository.FeatureRepository;
import com.example.api.repository.TagRepository;
import com.example.api.repository.TaskRepository;
import com.example.api.service.GameAccessService;
import jakarta.validation.Valid;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/games/{gameId}/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskRepository taskRepository;
    private final FeatureRepository featureRepository;
    private final CategoryRepository categoryRepository;
    private final TagRepository tagRepository;
    private final GameAccessService gameAccessService;

    @GetMapping
    public ResponseEntity<List<Task>> listTasks(
            @PathVariable("gameId") @NonNull String gameId,
            @RequestParam(name = "featureId", required = false) Optional<String> featureId,
            @RequestParam(name = "status", required = false) Optional<TaskStatus> status,
            @RequestParam(name = "categoryId", required = false) Optional<String> categoryId,
            @RequestParam(name = "tagIds", required = false) List<String> tagIdsParam,
            @RequestParam(name = "tagMode", required = false, defaultValue = "ANY") String tagMode,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        String featureIdParam = featureId.filter(f -> !f.isBlank()).orElse(null);
        TaskStatus statusParam = status.orElse(null);
        String categoryIdParam = categoryId.filter(c -> !c.isBlank()).orElse(null);
        List<String> tagIdsList = normalizeTagIdsQuery(tagIdsParam);
        boolean matchAll = tagMode != null && "ALL".equalsIgnoreCase(tagMode.trim());

        List<Task> tasks;
        if (tagIdsList.isEmpty()) {
            tasks = taskRepository.findByGameIdFiltered(gameId, featureIdParam, statusParam, categoryIdParam);
        } else if (matchAll) {
            tasks = taskRepository.findByGameIdFilteredMatchingAllTags(
                    gameId,
                    featureIdParam,
                    statusParam,
                    categoryIdParam,
                    tagIdsList,
                    tagIdsList.size());
        } else {
            tasks = taskRepository.findByGameIdFilteredMatchingAnyTag(
                    gameId, featureIdParam, statusParam, categoryIdParam, tagIdsList);
        }
        return ResponseEntity.ok(tasks);
    }

    @PostMapping
    public ResponseEntity<Task> createTask(
            @PathVariable("gameId") @NonNull String gameId,
            @Valid @RequestBody TaskUpsertRequest req,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        String featureId = Objects.requireNonNull(req.featureId(), "featureId");
        Feature feature = featureRepository
                .findByIdAndGameId(featureId, gameId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "featureId is invalid"));

        Task task = new Task();
        task.setTitle(req.title());
        task.setDescription(req.description());
        task.setStatus(req.status());
        task.setFeature(feature);
        task.setCategory(resolveCategory(gameId, req.categoryId()));
        task.setParent(resolveParentForUpsert(gameId, featureId, req.parentTaskId(), null));
        task.setTags(resolveTagsForGame(gameId, req.tagIdsOrNull() != null ? req.tagIdsOrNull() : List.of()));

        Task saved = taskRepository.save(task);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Task> updateTask(
            @PathVariable("gameId") @NonNull String gameId,
            @PathVariable("id") @NonNull String id,
            @Valid @RequestBody TaskUpsertRequest req,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        Task existing = taskRepository
                .findByIdAndFeature_Game_Id(id, gameId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "task not found"));

        String featureId = Objects.requireNonNull(req.featureId(), "featureId");
        Feature feature = featureRepository
                .findByIdAndGameId(featureId, gameId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "featureId is invalid"));

        existing.setTitle(req.title());
        existing.setDescription(req.description());
        existing.setStatus(req.status());
        existing.setFeature(feature);
        existing.setCategory(resolveCategory(gameId, req.categoryId()));
        existing.setParent(resolveParentForUpsert(gameId, featureId, req.parentTaskId(), id));
        if (req.tagIdsOrNull() != null) {
            existing.setTags(resolveTagsForGame(gameId, req.tagIdsOrNull()));
        }

        Task saved = taskRepository.save(existing);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(
            @PathVariable("gameId") @NonNull String gameId,
            @PathVariable("id") @NonNull String id,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        if (taskRepository.findByIdAndFeature_Game_Id(id, gameId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "task not found");
        }
        taskRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private static List<String> normalizeTagIdsQuery(List<String> raw) {
        if (raw == null || raw.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<String> out = new LinkedHashSet<>();
        for (String s : raw) {
            if (s == null || s.isBlank()) {
                continue;
            }
            String t = s.trim();
            if (t.contains(",")) {
                for (String part : t.split(",")) {
                    String p = part.trim();
                    if (!p.isEmpty()) {
                        out.add(p);
                    }
                }
            } else {
                out.add(t);
            }
        }
        return List.copyOf(out);
    }

    private LinkedHashSet<Tag> resolveTagsForGame(String gameId, List<String> tagIds) {
        if (tagIds.isEmpty()) {
            return new LinkedHashSet<>();
        }
        List<Tag> found = tagRepository.findAllByIdInAndGameId(tagIds, gameId);
        if (found.size() != tagIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "tagIds contain invalid tags");
        }
        return new LinkedHashSet<>(found);
    }

    private Category resolveCategory(String gameId, String categoryId) {
        if (categoryId == null) {
            return null;
        }
        return categoryRepository
                .findByIdAndGameId(categoryId, gameId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "categoryId is invalid"));
    }

    /**
     * Resolves parent task for create/update, or null for a root task. Validates game, feature alignment,
     * self-parent, and cycles (new parent must not be the task or one of its descendants).
     */
    private Task resolveParentForUpsert(
            String gameId, String featureId, String parentTaskId, String taskIdBeingUpdatedOrNull) {
        if (parentTaskId == null) {
            return null;
        }
        Task parent = taskRepository
                .findByIdAndFeature_Game_Id(parentTaskId, gameId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "parentTaskId is invalid"));
        if (!parent.getFeature().getId().equals(featureId)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "parentTaskId must reference a task on the same feature");
        }
        if (taskIdBeingUpdatedOrNull != null) {
            if (parentTaskId.equals(taskIdBeingUpdatedOrNull)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "task cannot be its own parent");
            }
            String walkId = parent.getId();
            int hops = 0;
            while (walkId != null && hops++ < 1000) {
                if (walkId.equals(taskIdBeingUpdatedOrNull)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "parentTaskId would create a cycle");
                }
                walkId = taskRepository.findParentIdById(walkId).orElse(null);
            }
        }
        return parent;
    }
}
