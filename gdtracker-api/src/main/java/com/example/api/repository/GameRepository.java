package com.example.api.repository;

import com.example.api.model.Game;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GameRepository extends JpaRepository<Game, String> {
    List<Game> findByOwnerIdOrderByNameAsc(String ownerId);

    Optional<Game> findByIdAndOwnerId(String id, String ownerId);
}
