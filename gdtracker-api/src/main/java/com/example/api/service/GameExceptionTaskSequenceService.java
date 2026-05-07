package com.example.api.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GameExceptionTaskSequenceService {

    private final JdbcTemplate jdbcTemplate;

    /**
     * Atomically reserves the next task index for this exception (per-exception monotonic sequence).
     * First reservation returns 1, then 2, etc. Deletes of tasks do not shrink the sequence.
     */
    @Transactional
    public int reserveNextIndex(String gameExceptionId) {
        Integer assigned = jdbcTemplate.queryForObject(
                """
                INSERT INTO game_exception_task_sequences (game_exception_id, next_index)
                VALUES (?, 2)
                ON CONFLICT (game_exception_id) DO UPDATE
                SET next_index = game_exception_task_sequences.next_index + 1
                RETURNING next_index - 1
                """,
                Integer.class,
                gameExceptionId);
        if (assigned == null) {
            throw new IllegalStateException("reserve task index returned null");
        }
        return assigned;
    }
}
