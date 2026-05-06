package com.example.api.repository;

import com.example.api.model.GameConfiguration;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GameConfigurationRepository extends JpaRepository<GameConfiguration, String> {
    @EntityGraph(attributePaths = "defaultExceptionTaskCategory")
    Optional<GameConfiguration> findByGameId(String gameId);

    boolean existsByGameId(String gameId);
}
