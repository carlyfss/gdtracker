package com.example.api.service;

import com.example.api.GameConfigDefaults;
import com.example.api.model.Category;
import com.example.api.model.Game;
import com.example.api.model.GameConfiguration;
import com.example.api.repository.CategoryRepository;
import com.example.api.repository.GameConfigurationRepository;
import java.util.HashMap;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GameSetupService {

    private final CategoryRepository categoryRepository;
    private final GameConfigurationRepository gameConfigurationRepository;

    /**
     * Ensures the game has a configuration row and default exception category (idempotent).
     */
    @Transactional
    public void ensureGameBootstrap(Game game) {
        if (gameConfigurationRepository.existsByGameId(game.getId())) {
            return;
        }
        Category category = categoryRepository
                .findByGameIdAndNameIgnoreCase(game.getId(), GameConfigDefaults.DEFAULT_EXCEPTION_CATEGORY_NAME)
                .orElseGet(() -> {
                    Category c = new Category(GameConfigDefaults.DEFAULT_EXCEPTION_CATEGORY_NAME);
                    c.setColor(GameConfigDefaults.DEFAULT_EXCEPTION_CATEGORY_COLOR);
                    c.setGame(game);
                    return categoryRepository.save(c);
                });

        GameConfiguration configuration = new GameConfiguration();
        configuration.setGame(game);
        configuration.setFeatureFlags(new HashMap<>());
        configuration.setSettings(new HashMap<>());
        configuration.setDefaultExceptionTaskCategory(category);
        gameConfigurationRepository.save(configuration);
    }
}
