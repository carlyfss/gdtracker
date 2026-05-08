package com.example.api.service;

import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GameExceptionTaskSequenceService {

    private final JdbcTemplate jdbcTemplate;

    /**
     * Atomically reserves the next task index for this game (per-game monotonic sequence).
     * First reservation returns 1, then 2, etc. Deletes of tasks do not shrink the sequence.
     */
    @Transactional
    public int reserveNextIndexForGame(String gameId) {
        Integer assigned = jdbcTemplate.queryForObject(
                """
                INSERT INTO game_exception_task_sequences_per_game (game_id, next_index)
                VALUES (?, 2)
                ON CONFLICT (game_id) DO UPDATE
                SET next_index = game_exception_task_sequences_per_game.next_index + 1
                RETURNING next_index - 1
                """,
                Integer.class,
                gameId);
        return Objects.requireNonNull(assigned, "reserve task index returned null");
    }
}
