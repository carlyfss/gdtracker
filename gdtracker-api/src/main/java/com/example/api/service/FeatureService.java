package com.example.api.service;

import com.example.api.dto.FeatureUpsertRequest;
import com.example.api.model.Feature;
import com.example.api.model.Game;
import com.example.api.model.TaskStatus;
import com.example.api.repository.FeatureRepository;
import com.example.api.repository.TaskRepository;
import jakarta.validation.Valid;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class FeatureService {

    private static final Pattern COLOR_HEX = Pattern.compile("#[0-9A-Fa-f]{6}");

    private final FeatureRepository featureRepository;
    private final TaskRepository taskRepository;
    private final GameAccessService gameAccessService;

    @Transactional(readOnly = true)
    public List<Feature> listFeatures(@NonNull String gameId, @NonNull String userId, boolean archivedOnly) {
        gameAccessService.requireOwnedGame(gameId, userId);
        return featureRepository.findByGameIdAndArchivedOrderByNameAsc(gameId, archivedOnly);
    }

    @Transactional
    public Feature createFeature(@NonNull String gameId, @NonNull String userId, @Valid FeatureUpsertRequest req) {
        Game game = gameAccessService.requireOwnedGame(gameId, userId);
        Feature parent = resolveParent(gameId, req.parentId());
        if (parent != null && parent.isArchived()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "parent feature is archived");
        }
        assertNameUnique(gameId, null, parent, req.name());

        TaskStatus status = req.status() != null ? req.status() : TaskStatus.TODO;
        String color = resolveColorForCreate(req.color());

        Feature feature = new Feature(req.name());
        feature.setDescription(req.description());
        feature.setStatus(status);
        feature.setColor(color);
        feature.setGame(game);
        feature.setParent(parent);

        return featureRepository.save(feature);
    }

    @Transactional
    public Feature updateFeature(
            @NonNull String gameId,
            @NonNull String userId,
            @NonNull String featureId,
            @Valid FeatureUpsertRequest req) {
        gameAccessService.requireOwnedGame(gameId, userId);
        Feature existing = featureRepository
                .findByIdAndGameId(featureId, gameId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "feature not found"));
        if (existing.isArchived()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "feature is archived");
        }

        Feature parent = resolveParent(gameId, req.parentId());
        if (parent != null && parent.isArchived()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "parent feature is archived");
        }
        assertNoCycle(featureId, parent);
        assertNameUnique(gameId, existing.getId(), parent, req.name());

        existing.setName(req.name());
        existing.setDescription(req.description());
        if (req.status() != null) {
            existing.setStatus(req.status());
        }
        if (req.color() != null && !req.color().isBlank()) {
            existing.setColor(validateColor(req.color()));
        }
        existing.setParent(parent);

        return featureRepository.save(existing);
    }

    @Transactional
    public void archiveFeature(@NonNull String gameId, @NonNull String userId, @NonNull String featureId) {
        gameAccessService.requireOwnedGame(gameId, userId);
        Feature root = featureRepository
                .findByIdAndGameId(featureId, gameId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "feature not found"));
        if (root.isArchived()) {
            return;
        }
        List<Feature> allInGame = featureRepository.findAllByGameIdOrderByNameAsc(gameId);
        Map<String, List<Feature>> childrenByParent = new HashMap<>();
        for (Feature f : allInGame) {
            String pk = f.getParent() == null ? null : f.getParent().getId();
            childrenByParent.computeIfAbsent(pk, k -> new ArrayList<>()).add(f);
        }
        Deque<String> queue = new ArrayDeque<>();
        queue.add(root.getId());
        Set<String> toArchive = new LinkedHashSet<>();
        while (!queue.isEmpty()) {
            String id = queue.removeFirst();
            if (!toArchive.add(id)) {
                continue;
            }
            for (Feature ch : childrenByParent.getOrDefault(id, List.of())) {
                queue.add(ch.getId());
            }
        }
        for (String id : toArchive) {
            Feature f = featureRepository.findByIdAndGameId(id, gameId).orElseThrow();
            f.setArchived(true);
            featureRepository.save(f);
        }
    }

    @Transactional
    public void deleteFeature(@NonNull String gameId, @NonNull String userId, @NonNull String featureId) {
        gameAccessService.requireOwnedGame(gameId, userId);
        if (featureRepository.findByIdAndGameId(featureId, gameId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "feature not found");
        }
        if (featureRepository.existsByParent_Id(featureId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "feature has subfeatures");
        }
        if (taskRepository.existsByFeatureId(featureId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "feature has tasks");
        }
        try {
            featureRepository.deleteById(featureId);
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "feature has subfeatures or tasks");
        }
    }

    private void assertNameUnique(String gameId, String selfId, Feature parent, String name) {
        featureRepository
                .findByGameIdAndNameIgnoreCaseInParent(name, gameId, parent)
                .filter(f -> selfId == null || !f.getId().equals(selfId))
                .ifPresent(f -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "feature already exists");
                });
    }

    private Feature resolveParent(String gameId, String parentId) {
        if (parentId == null || parentId.isBlank()) {
            return null;
        }
        return featureRepository
                .findByIdAndGameId(parentId, gameId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "parentId is invalid"));
    }

    private void assertNoCycle(String featureId, Feature newParent) {
        if (newParent == null) {
            return;
        }
        Feature walk = newParent;
        while (walk != null) {
            if (walk.getId().equals(featureId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "parent would create a cycle");
            }
            walk = walk.getParent();
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
}
