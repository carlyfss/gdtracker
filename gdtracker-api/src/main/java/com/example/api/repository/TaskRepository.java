package com.example.api.repository;

import com.example.api.model.Task;
import com.example.api.model.TaskStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TaskRepository extends JpaRepository<Task, String>, TaskAggregationRepository {

    @Query(
            """
            SELECT t FROM Task t
            WHERE t.feature.game.id = :gameId
            AND (:featureId IS NULL OR t.feature.id = :featureId)
            AND (:taskStatus IS NULL OR t.status = :taskStatus)
            AND (:categoryId IS NULL OR (t.category IS NOT NULL AND t.category.id = :categoryId))
            AND (:sourceGameExceptionId IS NULL
                OR (t.sourceGameException IS NOT NULL AND t.sourceGameException.id = :sourceGameExceptionId))
            AND ((:archivedOnly = false AND t.archivedAt IS NULL AND t.feature.archivedAt IS NULL)
                OR (:archivedOnly = true AND (t.archivedAt IS NOT NULL OR t.feature.archivedAt IS NOT NULL)))
            ORDER BY t.createdAt DESC
            """)
    List<Task> findByGameIdFiltered(
            @Param("gameId") String gameId,
            @Param("featureId") String featureId,
            @Param("taskStatus") TaskStatus taskStatus,
            @Param("categoryId") String categoryId,
            @Param("sourceGameExceptionId") String sourceGameExceptionId,
            @Param("archivedOnly") boolean archivedOnly);

    @Query(
            """
            SELECT DISTINCT t FROM Task t JOIN t.tags g
            WHERE t.feature.game.id = :gameId
            AND (:featureId IS NULL OR t.feature.id = :featureId)
            AND (:taskStatus IS NULL OR t.status = :taskStatus)
            AND (:categoryId IS NULL OR (t.category IS NOT NULL AND t.category.id = :categoryId))
            AND (:sourceGameExceptionId IS NULL
                OR (t.sourceGameException IS NOT NULL AND t.sourceGameException.id = :sourceGameExceptionId))
            AND g.id IN :tagIds
            AND ((:archivedOnly = false AND t.archivedAt IS NULL AND t.feature.archivedAt IS NULL)
                OR (:archivedOnly = true AND (t.archivedAt IS NOT NULL OR t.feature.archivedAt IS NOT NULL)))
            ORDER BY t.createdAt DESC
            """)
    List<Task> findByGameIdFilteredMatchingAnyTag(
            @Param("gameId") String gameId,
            @Param("featureId") String featureId,
            @Param("taskStatus") TaskStatus taskStatus,
            @Param("categoryId") String categoryId,
            @Param("sourceGameExceptionId") String sourceGameExceptionId,
            @Param("tagIds") List<String> tagIds,
            @Param("archivedOnly") boolean archivedOnly);

    @Query(
            """
            SELECT t FROM Task t
            WHERE t.feature.game.id = :gameId
            AND (:featureId IS NULL OR t.feature.id = :featureId)
            AND (:taskStatus IS NULL OR t.status = :taskStatus)
            AND (:categoryId IS NULL OR (t.category IS NOT NULL AND t.category.id = :categoryId))
            AND (:sourceGameExceptionId IS NULL
                OR (t.sourceGameException IS NOT NULL AND t.sourceGameException.id = :sourceGameExceptionId))
            AND (SELECT COUNT(g2) FROM Task tt JOIN tt.tags g2 WHERE tt.id = t.id AND g2.id IN :tagIds) = :tagCount
            AND ((:archivedOnly = false AND t.archivedAt IS NULL AND t.feature.archivedAt IS NULL)
                OR (:archivedOnly = true AND (t.archivedAt IS NOT NULL OR t.feature.archivedAt IS NOT NULL)))
            ORDER BY t.createdAt DESC
            """)
    List<Task> findByGameIdFilteredMatchingAllTags(
            @Param("gameId") String gameId,
            @Param("featureId") String featureId,
            @Param("taskStatus") TaskStatus taskStatus,
            @Param("categoryId") String categoryId,
            @Param("sourceGameExceptionId") String sourceGameExceptionId,
            @Param("tagIds") List<String> tagIds,
            @Param("tagCount") long tagCount,
            @Param("archivedOnly") boolean archivedOnly);

    List<Task> findAllByFeature_IdIn(List<String> featureIds);

    @Modifying
    @Query("DELETE FROM Task t WHERE t.feature.game.id = :gameId"
            + " AND t.archivedAt IS NOT NULL AND t.archivedAt < :cutoff")
    int deleteArchivedByGameIdBefore(@Param("gameId") String gameId, @Param("cutoff") Instant cutoff);

    boolean existsByFeatureId(String featureId);

    boolean existsByCategoryId(String categoryId);

    Optional<Task> findByIdAndFeature_Game_Id(String id, String gameId);

    /**
     * Parent id for cycle detection without traversing {@code Task.parent} (LAZY) outside a session.
     */
    @Query("SELECT t.parent.id FROM Task t WHERE t.id = :id")
    Optional<String> findParentIdById(@Param("id") String id);
}
