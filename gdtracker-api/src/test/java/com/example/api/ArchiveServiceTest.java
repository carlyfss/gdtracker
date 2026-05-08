package com.example.api;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.example.api.model.ArchivedFeature;
import com.example.api.model.Feature;
import com.example.api.model.Game;
import com.example.api.model.Task;
import com.example.api.model.TaskStatus;
import com.example.api.repository.ArchivedFeatureRepository;
import com.example.api.repository.ArchivedTaskRepository;
import com.example.api.repository.FeatureRepository;
import com.example.api.repository.TaskRepository;
import com.example.api.service.ArchiveService;
import com.example.api.service.GameAccessService;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

@SuppressWarnings("null")
class ArchiveServiceTest {

    private static final String GAME_ID = "game-1";
    private static final String USER_ID = "user-1";

    @Mock
    private FeatureRepository featureRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private ArchivedFeatureRepository archivedFeatureRepository;

    @Mock
    private ArchivedTaskRepository archivedTaskRepository;

    @Mock
    private GameAccessService gameAccessService;

    private ArchiveService archiveService;

    @BeforeEach
    void setup() {
        MockitoAnnotations.openMocks(this);
        archiveService = new ArchiveService(
                featureRepository,
                taskRepository,
                archivedFeatureRepository,
                archivedTaskRepository,
                gameAccessService);
        when(gameAccessService.requireOwnedGame(eq(GAME_ID), eq(USER_ID))).thenReturn(new Game());
    }

    @Test
    void unarchiveTask_whenFeatureArchived_createsRestoredCopyAndMovesTask() {
        Feature archivedFeature = new Feature("F");
        archivedFeature.setId("feature-arch");
        archivedFeature.setArchivedAt(Instant.now());
        archivedFeature.setArchived(true);
        archivedFeature.setStatus(TaskStatus.TODO);
        archivedFeature.setColor("#818cf8");
        archivedFeature.setGame(new Game());

        Task t = new Task();
        t.setId("task-1");
        t.setFeature(archivedFeature);
        t.setArchivedAt(Instant.now());
        t.setArchived(true);

        ArchivedFeature mapping = new ArchivedFeature();
        mapping.setFeatureId(archivedFeature.getId());
        mapping.setArchivedAt(Instant.now());
        mapping.setRestoredFeature(null);

        when(taskRepository.findByIdAndFeature_Game_Id("task-1", GAME_ID)).thenReturn(Optional.of(t));
        when(archivedFeatureRepository.findById("feature-arch")).thenReturn(Optional.of(mapping));
        when(featureRepository.findByGameIdAndNameIgnoreCaseInParent(anyString(), eq(GAME_ID), isNull()))
                .thenReturn(Optional.empty());

        ArgumentCaptor<Feature> featureSave = ArgumentCaptor.forClass(Feature.class);
        when(featureRepository.save(featureSave.capture())).thenAnswer((inv) -> {
            Feature f = inv.getArgument(0, Feature.class);
            if (f.getId() == null) {
                f.setId("feature-restored");
            }
            return f;
        });
        when(taskRepository.save(any(Task.class))).thenAnswer((inv) -> inv.getArgument(0, Task.class));

        archiveService.unarchiveTask(GAME_ID, USER_ID, "task-1");

        assertEquals("feature-restored", t.getFeature().getId());
        assertNull(t.getArchivedAt());
        assertFalse(t.isArchived());
        assertNotNull(mapping.getRestoredFeature());
        assertEquals("feature-restored", mapping.getRestoredFeature().getId());
        assertTrue(featureSave.getValue().getName().toLowerCase().contains("restored"));
        verify(archivedTaskRepository).deleteById("task-1");
    }

    @Test
    void archiveFeature_whenRestoredCopy_mergesBackTasksAndDeletesRestoredFeature() {
        Feature restored = new Feature("F (restored)");
        restored.setId("feature-restored");
        restored.setArchivedAt(null);
        restored.setGame(new Game());

        Feature originalArchived = new Feature("F");
        originalArchived.setId("feature-orig");
        originalArchived.setArchivedAt(Instant.now());
        originalArchived.setArchived(true);
        originalArchived.setGame(new Game());

        ArchivedFeature mapping = new ArchivedFeature();
        mapping.setFeatureId("feature-orig");
        mapping.setArchivedAt(Instant.now());
        mapping.setRestoredFeature(restored);

        Task moved = new Task();
        moved.setId("task-1");
        moved.setFeature(restored);
        moved.setArchived(false);
        moved.setArchivedAt(null);

        when(archivedFeatureRepository.findByRestoredFeature_Id("feature-restored"))
                .thenReturn(Optional.of(mapping));
        when(featureRepository.findByIdAndGameId("feature-restored", GAME_ID)).thenReturn(Optional.of(restored));
        when(featureRepository.findByIdAndGameId("feature-orig", GAME_ID)).thenReturn(Optional.of(originalArchived));
        when(taskRepository.findAllByFeature_IdIn(List.of("feature-restored"))).thenReturn(List.of(moved));
        when(taskRepository.save(any(Task.class))).thenAnswer((inv) -> inv.getArgument(0, Task.class));

        archiveService.archiveFeature(GAME_ID, USER_ID, "feature-restored");

        assertEquals("feature-orig", moved.getFeature().getId());
        assertNotNull(moved.getArchivedAt());
        assertTrue(moved.isArchived());
        assertNull(mapping.getRestoredFeature());
        verify(featureRepository).deleteById("feature-restored");
    }
}
