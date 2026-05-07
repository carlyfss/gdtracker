package com.example.api.repository;

import com.example.api.model.GamePlayer;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GamePlayerRepository extends JpaRepository<GamePlayer, String> {

    Optional<GamePlayer> findByIdAndGame_Id(String id, String gameId);
}
