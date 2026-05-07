package com.example.api.repository;

import java.util.List;

/**
 * Custom {@link TaskRepository} fragment for aggregations backed by external {@code .sql} resources.
 * Implementation lives in {@link TaskAggregationRepositoryImpl}.
 */
public interface TaskAggregationRepository {

    /**
     * Aggregate active (non-archived) task counts per feature for a game.
     *
     * @return rows of {@code [feature_id, total, done]}.
     */
    List<Object[]> aggregateTaskCountsByFeatureForGame(String gameId);

    /**
     * Aggregate archived task counts per feature for a game (either the task or the feature is archived).
     *
     * @return rows of {@code [feature_id, total, done]}.
     */
    List<Object[]> aggregateArchivedTaskCountsByFeatureForGame(String gameId);
}
