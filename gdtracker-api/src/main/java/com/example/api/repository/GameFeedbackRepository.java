package com.example.api.repository;

import com.example.api.model.GameFeedback;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GameFeedbackRepository extends JpaRepository<GameFeedback, String> {

    List<GameFeedback> findByGame_IdOrderByCreatedAtDesc(String gameId);

    Optional<GameFeedback> findByIdAndGame_Id(String id, String gameId);
}
