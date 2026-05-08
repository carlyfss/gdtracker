package com.example.api.service;

import com.example.api.model.Game;
import com.example.api.model.GameConfiguration;
import com.example.api.repository.FeatureRepository;
import com.example.api.repository.GameConfigurationRepository;
import com.example.api.repository.GameRepository;
import com.example.api.repository.TaskRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ArchiveRetentionService {

    public static final String ARCHIVE_TIME_BOMB = "ARCHIVE_TIME_BOMB";
    private static final long DEFAULT_DAYS = 30;

    private final GameRepository gameRepository;
    private final GameConfigurationRepository gameConfigurationRepository;
    private final TaskRepository taskRepository;
    private final FeatureRepository featureRepository;

    @Scheduled(cron = "0 17 3 * * *")
    @Transactional
    public void purgeExpiredArchivedItems() {
        List<Game> games = gameRepository.findAll();
        for (Game g : games) {
            String gameId = g.getId();
            if (gameId == null) {
                continue;
            }
            long days = resolveArchiveDays(gameId);
            Instant cutoff = Instant.now().minus(days, ChronoUnit.DAYS);

            int deletedTasks = taskRepository.deleteArchivedByGameIdBefore(gameId, cutoff);
            int deletedFeatures = featureRepository.deleteArchivedByGameIdBefore(gameId, cutoff);
            if (deletedTasks > 0 || deletedFeatures > 0) {
                log.info(
                        "archive retention purged gameId={} days={} cutoff={} deletedTasks={} deletedFeatures={}",
                        gameId,
                        days,
                        cutoff,
                        deletedTasks,
                        deletedFeatures);
            }
        }
    }

    private long resolveArchiveDays(String gameId) {
        GameConfiguration cfg = gameConfigurationRepository.findByGameId(gameId).orElse(null);
        Map<String, Object> settings = cfg != null ? cfg.getSettings() : Map.of();
        Object raw = settings.get(ARCHIVE_TIME_BOMB);
        if (raw instanceof Number n) {
            long v = n.longValue();
            return v > 0 ? v : DEFAULT_DAYS;
        }
        if (raw instanceof String s) {
            try {
                long v = Long.parseLong(s.trim());
                return v > 0 ? v : DEFAULT_DAYS;
            } catch (NumberFormatException ignored) {
                return DEFAULT_DAYS;
            }
        }
        return DEFAULT_DAYS;
    }
}
