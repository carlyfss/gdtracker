package com.example.api.service;

import com.example.api.model.ArchivedFeature;
import com.example.api.model.ArchivedTask;
import com.example.api.model.Feature;
import com.example.api.model.Task;
import com.example.api.repository.ArchivedFeatureRepository;
import com.example.api.repository.ArchivedTaskRepository;
import com.example.api.repository.FeatureRepository;
import com.example.api.repository.TaskRepository;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class ArchiveService {

    private final FeatureRepository featureRepository;
    private final TaskRepository taskRepository;
    private final ArchivedFeatureRepository archivedFeatureRepository;
    private final ArchivedTaskRepository archivedTaskRepository;
    private final GameAccessService gameAccessService;

    @Transactional
    public void archiveFeature(@NonNull String gameId, @NonNull String userId, @NonNull String featureId) {
        gameAccessService.requireOwnedGame(gameId, userId);

        // If this is a restored-copy feature, archiving it means merge back into the original archived feature.
        Optional<ArchivedFeature> restoredMapping = archivedFeatureRepository.findByRestoredFeature_Id(featureId);
        if (restoredMapping.isPresent()) {
            mergeBackRestoredFeature(gameId, featureId, restoredMapping.get());
            return;
        }

        Feature root = featureRepository
                .findByIdAndGameId(featureId, gameId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "feature not found"));
        if (root.getArchivedAt() != null) {
            return;
        }

        Instant now = Instant.now();
        List<String> toArchiveIds = collectFeatureSubtreeIds(gameId, Objects.requireNonNull(root.getId(), "feature.id"));
        for (String id : toArchiveIds) {
            Feature f = featureRepository.findByIdAndGameId(id, gameId).orElseThrow();
            f.setArchivedAt(now);
            f.setArchived(true);
            featureRepository.save(f);

            String fid = Objects.requireNonNull(f.getId(), "feature.id");
            ArchivedFeature af = archivedFeatureRepository.findById(fid).orElseGet(ArchivedFeature::new);
            af.setFeatureId(fid);
            af.setArchivedAt(now);
            archivedFeatureRepository.save(af);
        }

        // Timebomb semantics: every archive-visible task should get an archivedAt and archived_tasks entry.
        List<Task> tasks = taskRepository.findAllByFeature_IdIn(toArchiveIds);
        for (Task t : tasks) {
            t.setArchivedAt(now);
            t.setArchived(true);
            taskRepository.save(t);

            String tid = Objects.requireNonNull(t.getId(), "task.id");
            ArchivedTask at = archivedTaskRepository.findById(tid).orElseGet(ArchivedTask::new);
            at.setTaskId(tid);
            at.setArchivedAt(now);
            at.setArchivedFeature(t.getFeature());
            archivedTaskRepository.save(at);
        }
    }

    @Transactional
    public void unarchiveFeature(@NonNull String gameId, @NonNull String userId, @NonNull String featureId) {
        gameAccessService.requireOwnedGame(gameId, userId);

        Feature root = featureRepository
                .findByIdAndGameId(featureId, gameId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "feature not found"));
        if (root.getArchivedAt() == null) {
            return;
        }

        List<String> subtreeIds = collectFeatureSubtreeIds(gameId, Objects.requireNonNull(root.getId(), "feature.id"));
        for (String id : subtreeIds) {
            Feature f = featureRepository.findByIdAndGameId(id, gameId).orElseThrow();
            f.setArchivedAt(null);
            f.setArchived(false);
            featureRepository.save(f);
            archivedFeatureRepository.deleteById(Objects.requireNonNull(id, "feature.id"));
        }

        List<Task> tasks = taskRepository.findAllByFeature_IdIn(subtreeIds);
        for (Task t : tasks) {
            t.setArchivedAt(null);
            t.setArchived(false);
            taskRepository.save(t);
            archivedTaskRepository.deleteById(Objects.requireNonNull(t.getId(), "task.id"));
        }
    }

    @Transactional
    public void archiveTask(@NonNull String gameId, @NonNull String userId, @NonNull String taskId) {
        gameAccessService.requireOwnedGame(gameId, userId);
        Task task = taskRepository
                .findByIdAndFeature_Game_Id(taskId, gameId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "task not found"));

        if (task.getArchivedAt() != null) {
            return;
        }

        Instant now = Instant.now();
        task.setArchivedAt(now);
        task.setArchived(true);
        taskRepository.save(task);

        String tid = Objects.requireNonNull(task.getId(), "task.id");
        ArchivedTask at = archivedTaskRepository.findById(tid).orElseGet(ArchivedTask::new);
        at.setTaskId(tid);
        at.setArchivedAt(now);
        at.setArchivedFeature(task.getFeature().getArchivedAt() != null ? task.getFeature() : null);
        archivedTaskRepository.save(at);
    }

    @Transactional
    public void unarchiveTask(@NonNull String gameId, @NonNull String userId, @NonNull String taskId) {
        gameAccessService.requireOwnedGame(gameId, userId);
        Task task = taskRepository
                .findByIdAndFeature_Game_Id(taskId, gameId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "task not found"));

        Feature feature = Objects.requireNonNull(task.getFeature(), "task.feature");
        boolean featureArchived = feature.getArchivedAt() != null;

        if (!featureArchived) {
            task.setArchivedAt(null);
            task.setArchived(false);
            taskRepository.save(task);
            archivedTaskRepository.deleteById(Objects.requireNonNull(task.getId(), "task.id"));
            return;
        }

        ArchivedFeature mapping = archivedFeatureRepository
                .findById(Objects.requireNonNull(feature.getId(), "feature.id"))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "archived feature metadata missing"));

        Feature restored = mapping.getRestoredFeature();
        if (restored == null) {
            restored = createRestoredCopyFeature(gameId, feature);
            mapping.setRestoredFeature(restored);
            archivedFeatureRepository.save(mapping);
        }

        task.setFeature(restored);
        task.setArchivedAt(null);
        task.setArchived(false);
        taskRepository.save(task);
        archivedTaskRepository.deleteById(Objects.requireNonNull(task.getId(), "task.id"));
    }

    private void mergeBackRestoredFeature(String gameId, String restoredFeatureId, ArchivedFeature mapping) {
        Feature restored = featureRepository
                .findByIdAndGameId(restoredFeatureId, gameId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "feature not found"));
        String originalId = mapping.getFeatureId();
        Feature originalArchived = featureRepository
                .findByIdAndGameId(originalId, gameId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "feature not found"));

        Instant now = Instant.now();
        List<Task> restoredTasks =
                taskRepository.findAllByFeature_IdIn(List.of(Objects.requireNonNull(restored.getId(), "feature.id")));
        for (Task t : restoredTasks) {
            t.setFeature(originalArchived);
            t.setArchivedAt(now);
            t.setArchived(true);
            taskRepository.save(t);

            String tid = Objects.requireNonNull(t.getId(), "task.id");
            ArchivedTask at = archivedTaskRepository.findById(tid).orElseGet(ArchivedTask::new);
            at.setTaskId(tid);
            at.setArchivedAt(now);
            at.setArchivedFeature(originalArchived);
            archivedTaskRepository.save(at);
        }

        mapping.setRestoredFeature(null);
        archivedFeatureRepository.save(mapping);
        featureRepository.deleteById(Objects.requireNonNull(restored.getId(), "feature.id"));
    }

    private Feature createRestoredCopyFeature(String gameId, Feature archivedFeature) {
        Feature parent = archivedFeature.getParent();

        String baseName = archivedFeature.getName() + " (restored)";
        String name = uniqueFeatureName(gameId, parent, baseName);

        Feature copy = new Feature(name);
        copy.setDescription(archivedFeature.getDescription());
        copy.setStatus(archivedFeature.getStatus());
        copy.setColor(archivedFeature.getColor());
        copy.setGame(archivedFeature.getGame());
        copy.setParent(parent);
        copy.setArchivedAt(null);
        copy.setArchived(false);
        return featureRepository.save(copy);
    }

    private String uniqueFeatureName(String gameId, Feature parent, String base) {
        String candidate = base;
        int n = 2;
        while (featureRepository.findByGameIdAndNameIgnoreCaseInParent(candidate, gameId, parent).isPresent()) {
            candidate = base + " (" + n++ + ")";
        }
        return candidate;
    }

    private List<String> collectFeatureSubtreeIds(String gameId, String rootId) {
        List<Feature> allInGame = featureRepository.findAllByGameIdOrderByNameAsc(gameId);
        Map<String, List<Feature>> childrenByParent = new HashMap<>();
        for (Feature f : allInGame) {
            String pk = f.getParent() == null ? null : f.getParent().getId();
            childrenByParent.computeIfAbsent(pk, k -> new ArrayList<>()).add(f);
        }
        Deque<String> queue = new ArrayDeque<>();
        queue.add(rootId);
        Set<String> ids = new LinkedHashSet<>();
        while (!queue.isEmpty()) {
            String id = queue.removeFirst();
            if (!ids.add(id)) {
                continue;
            }
            for (Feature ch : childrenByParent.getOrDefault(id, List.of())) {
                queue.add(ch.getId());
            }
        }
        return List.copyOf(ids);
    }
}

