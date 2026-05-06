package com.example.api.repository;

import com.example.api.model.GameEventTrace;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GameEventTraceRepository extends JpaRepository<GameEventTrace, String> {

    @EntityGraph(attributePaths = {"gameEvent", "gameEvent.definition"})
    List<GameEventTrace> findByGameIdOrderByTimestampDesc(String gameId);
}
