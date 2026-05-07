package com.example.api.repository;

import com.example.api.model.Feature;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface FeatureRepository extends JpaRepository<Feature, String> {

    @Query(
            """
            SELECT DISTINCT f FROM Feature f
            LEFT JOIN FETCH f.parent
            WHERE f.game.id = :gameId AND f.archived = :archived
            ORDER BY f.name ASC
            """)
    List<Feature> findByGameIdAndArchivedOrderByNameAsc(
            @Param("gameId") String gameId, @Param("archived") boolean archived);

    @Query(
            """
            SELECT DISTINCT f FROM Feature f
            LEFT JOIN FETCH f.parent
            WHERE f.game.id = :gameId
            ORDER BY f.name ASC
            """)
    List<Feature> findAllByGameIdOrderByNameAsc(@Param("gameId") String gameId);

    Optional<Feature> findByGame_IdAndParentIsNullAndNameIgnoreCase(String gameId, String name);

    Optional<Feature> findByGame_IdAndParent_IdAndNameIgnoreCase(String gameId, String parentId, String name);

    Optional<Feature> findByIdAndGameId(String id, String gameId);

    boolean existsByParent_Id(String parentId);

    default Optional<Feature> findByGameIdAndNameIgnoreCaseInParent(String name, String gameId, Feature parent) {
        if (parent == null) {
            return findByGame_IdAndParentIsNullAndNameIgnoreCase(gameId, name);
        }
        return findByGame_IdAndParent_IdAndNameIgnoreCase(gameId, parent.getId(), name);
    }
}
