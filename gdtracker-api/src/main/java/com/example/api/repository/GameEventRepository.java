package com.example.api.repository;

import com.example.api.model.GameEvent;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface GameEventRepository extends JpaRepository<GameEvent, String> {

    @EntityGraph(attributePaths = "definition")
    @Query(
            """
            SELECT e FROM GameEvent e
            JOIN e.definition d
            WHERE e.game.id = :gameId
            AND (:code = '' OR LOWER(d.code) = LOWER(:code))
            AND (:q = '' OR LOWER(e.renderedMessage) LIKE LOWER(CONCAT('%', :q, '%'))
                 OR LOWER(d.code) LIKE LOWER(CONCAT('%', :q, '%')))
            ORDER BY e.timestamp DESC
            """)
    List<GameEvent> findFilteredForGame(
            @Param("gameId") String gameId, @Param("code") String code, @Param("q") String q, Pageable pageable);

    boolean existsByDefinition_Id(String definitionId);
}
