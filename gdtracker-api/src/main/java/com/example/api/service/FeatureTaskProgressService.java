package com.example.api.service;

import com.example.api.dto.FeatureTaskProgressRow;
import com.example.api.model.Feature;
import com.example.api.repository.FeatureRepository;
import com.example.api.repository.TaskRepository;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FeatureTaskProgressService {

    private final FeatureRepository featureRepository;
    private final TaskRepository taskRepository;
    private final GameAccessService gameAccessService;

    @Transactional(readOnly = true)
    public List<FeatureTaskProgressRow> progressForGame(@NonNull String gameId, @NonNull String userId) {
        gameAccessService.requireOwnedGame(gameId, userId);
        List<Feature> features = featureRepository.findByGameIdOrderByNameAsc(gameId);
        Map<String, long[]> direct = parseAggregates(taskRepository.aggregateTaskCountsByFeatureForGame(gameId));

        Map<String, List<Feature>> childrenByParent = new HashMap<>();
        for (Feature f : features) {
            String parentKey = f.getParent() == null ? null : f.getParent().getId();
            childrenByParent.computeIfAbsent(parentKey, k -> new ArrayList<>()).add(f);
        }

        Map<String, FeatureTaskProgressRow> memo = new HashMap<>();
        List<FeatureTaskProgressRow> out = new ArrayList<>();
        for (Feature f : features) {
            out.add(aggregateNode(f.getId(), childrenByParent, direct, memo));
        }
        return out;
    }

    private static Map<String, long[]> parseAggregates(List<Object[]> rows) {
        Map<String, long[]> m = new HashMap<>();
        for (Object[] row : rows) {
            String fid = row[0] != null ? row[0].toString() : "";
            long total = row[1] != null ? ((Number) row[1]).longValue() : 0L;
            long done = row[2] != null ? ((Number) row[2]).longValue() : 0L;
            m.put(fid, new long[] {total, done});
        }
        return m;
    }

    private FeatureTaskProgressRow aggregateNode(
            String featureId,
            Map<String, List<Feature>> childrenByParent,
            Map<String, long[]> direct,
            Map<String, FeatureTaskProgressRow> memo) {
        FeatureTaskProgressRow cached = memo.get(featureId);
        if (cached != null) {
            return cached;
        }
        long[] d = direct.getOrDefault(featureId, new long[] {0L, 0L});
        long rolledTotal = d[0];
        long rolledDone = d[1];
        for (Feature child : childrenByParent.getOrDefault(featureId, List.of())) {
            FeatureTaskProgressRow sub = aggregateNode(child.getId(), childrenByParent, direct, memo);
            rolledTotal += sub.rolledUpTotal();
            rolledDone += sub.rolledUpDone();
        }
        FeatureTaskProgressRow row = new FeatureTaskProgressRow(featureId, d[0], d[1], rolledTotal, rolledDone);
        memo.put(featureId, row);
        return row;
    }
}
