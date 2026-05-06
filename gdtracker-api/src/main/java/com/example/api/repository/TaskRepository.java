package com.example.api.repository;

import com.example.api.model.Task;
import com.example.api.model.TaskStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TaskRepository extends JpaRepository<Task, String> {

    @Query(
            """
            SELECT t FROM Task t
            WHERE t.feature.game.id = :gameId
            AND (:featureId IS NULL OR t.feature.id = :featureId)
            AND (:taskStatus IS NULL OR t.status = :taskStatus)
            AND (:categoryId IS NULL OR (t.category IS NOT NULL AND t.category.id = :categoryId))
            ORDER BY t.createdAt DESC
            """)
    List<Task> findByGameIdFiltered(
            @Param("gameId") String gameId,
            @Param("featureId") String featureId,
            @Param("taskStatus") TaskStatus taskStatus,
            @Param("categoryId") String categoryId);

    @Query(
            """
            SELECT DISTINCT t FROM Task t JOIN t.tags g
            WHERE t.feature.game.id = :gameId
            AND (:featureId IS NULL OR t.feature.id = :featureId)
            AND (:taskStatus IS NULL OR t.status = :taskStatus)
            AND (:categoryId IS NULL OR (t.category IS NOT NULL AND t.category.id = :categoryId))
            AND g.id IN :tagIds
            ORDER BY t.createdAt DESC
            """)
    List<Task> findByGameIdFilteredMatchingAnyTag(
            @Param("gameId") String gameId,
            @Param("featureId") String featureId,
            @Param("taskStatus") TaskStatus taskStatus,
            @Param("categoryId") String categoryId,
            @Param("tagIds") List<String> tagIds);

    @Query(
            """
            SELECT t FROM Task t
            WHERE t.feature.game.id = :gameId
            AND (:featureId IS NULL OR t.feature.id = :featureId)
            AND (:taskStatus IS NULL OR t.status = :taskStatus)
            AND (:categoryId IS NULL OR (t.category IS NOT NULL AND t.category.id = :categoryId))
            AND (SELECT COUNT(g2) FROM Task tt JOIN tt.tags g2 WHERE tt.id = t.id AND g2.id IN :tagIds) = :tagCount
            ORDER BY t.createdAt DESC
            """)
    List<Task> findByGameIdFilteredMatchingAllTags(
            @Param("gameId") String gameId,
            @Param("featureId") String featureId,
            @Param("taskStatus") TaskStatus taskStatus,
            @Param("categoryId") String categoryId,
            @Param("tagIds") List<String> tagIds,
            @Param("tagCount") long tagCount);

    boolean existsByFeatureId(String featureId);

    boolean existsByCategoryId(String categoryId);

    Optional<Task> findByIdAndFeature_Game_Id(String id, String gameId);

    /**
     * Parent id for cycle detection without traversing {@code Task.parent} (LAZY) outside a session.
     */
    @Query("SELECT t.parent.id FROM Task t WHERE t.id = :id")
    Optional<String> findParentIdById(@Param("id") String id);

    @Query(
            value =
                    """
                    SELECT CAST(t.feature_id AS varchar) AS fid,
                           CAST(COUNT(*) AS bigint) AS total_cnt,
                           CAST(COUNT(*) FILTER (WHERE t.status = 'DONE') AS bigint) AS done_cnt
                    FROM tasks t
                    INNER JOIN features f ON f.id = t.feature_id
                    WHERE f.game_id = :gameId
                    GROUP BY t.feature_id
                    """,
            nativeQuery = true)
    List<Object[]> aggregateTaskCountsByFeatureForGame(@Param("gameId") String gameId);
}
