package com.example.api.repository;

import com.example.api.model.GameFeedbackMeterDefinition;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GameFeedbackMeterDefinitionRepository extends JpaRepository<GameFeedbackMeterDefinition, String> {

    List<GameFeedbackMeterDefinition> findByGame_IdOrderBySortOrderAscFieldKeyAsc(String gameId);

    Optional<GameFeedbackMeterDefinition> findByIdAndGame_Id(String id, String gameId);

    Optional<GameFeedbackMeterDefinition> findByGame_IdAndFieldKeyIgnoreCase(String gameId, String fieldKey);

    boolean existsByGame_IdAndFieldKeyIgnoreCase(String gameId, String fieldKey);
}
