package com.example.api.repository;

import com.example.api.model.GameException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface GameExceptionRepository extends JpaRepository<GameException, String> {
    List<GameException> findByGameIdOrderByTimestampDesc(String gameId);

    List<GameException> findByGameIdAndTimestampBetweenOrderByTimestampDesc(String gameId, Instant from, Instant to);

    @Query("SELECT e FROM GameException e WHERE e.id = :id AND e.game.id = :gameId")
    Optional<GameException> findByIdAndGameId(@Param("id") String id, @Param("gameId") String gameId);

    @Query(
            """
            SELECT e FROM GameException e
            WHERE e.game.id = :gameId
              AND (:q = ''
                OR LOWER(e.id) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(e.shortErrorMessage) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(e.errorMessage) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(e.stackTrace) LIKE LOWER(CONCAT('%', :q, '%')))
            ORDER BY e.timestamp DESC
            """)
    Page<GameException> searchForGame(@Param("gameId") String gameId, @Param("q") String q, Pageable pageable);
}
