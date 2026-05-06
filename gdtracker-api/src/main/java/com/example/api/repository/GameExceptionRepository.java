package com.example.api.repository;

import com.example.api.model.GameException;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GameExceptionRepository extends JpaRepository<GameException, String> {
    List<GameException> findByGameIdOrderByTimestampDesc(String gameId);

    List<GameException> findByGameIdAndTimestampBetweenOrderByTimestampDesc(String gameId, Instant from, Instant to);
}
