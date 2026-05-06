package com.example.api.repository;

import com.example.api.model.GameEventDefinition;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GameEventDefinitionRepository extends JpaRepository<GameEventDefinition, String> {

    List<GameEventDefinition> findByGame_IdOrderByCodeAsc(String gameId);

    Optional<GameEventDefinition> findByGame_IdAndCodeIgnoreCase(String gameId, String code);

    Optional<GameEventDefinition> findByIdAndGame_Id(String id, String gameId);

    boolean existsByGame_IdAndCodeIgnoreCase(String gameId, String code);
}
