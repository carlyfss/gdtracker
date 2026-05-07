package com.example.api.repository;

import com.example.api.util.SqlResources;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;

/**
 * Spring Data JPA fragment implementation. Spring Data discovers this class by the
 * {@code <FragmentInterface>Impl} naming convention.
 */
public class TaskAggregationRepositoryImpl implements TaskAggregationRepository {

    private static final String AGGREGATE_ACTIVE_SQL_PATH = "sql/tasks/aggregate_task_counts_by_feature_for_game.sql";
    private static final String AGGREGATE_ARCHIVED_SQL_PATH =
            "sql/tasks/aggregate_archived_task_counts_by_feature_for_game.sql";

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    @SuppressWarnings("unchecked")
    public List<Object[]> aggregateTaskCountsByFeatureForGame(String gameId) {
        return entityManager
                .createNativeQuery(SqlResources.read(AGGREGATE_ACTIVE_SQL_PATH))
                .setParameter("gameId", gameId)
                .getResultList();
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<Object[]> aggregateArchivedTaskCountsByFeatureForGame(String gameId) {
        return entityManager
                .createNativeQuery(SqlResources.read(AGGREGATE_ARCHIVED_SQL_PATH))
                .setParameter("gameId", gameId)
                .getResultList();
    }
}
