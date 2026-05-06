package com.example.api.service;

import com.example.api.model.Game;
import com.example.api.repository.GameRepository;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class GameIngestTokenService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final GameRepository gameRepository;

    @Qualifier("ingestTokenPasswordEncoder")
    private final PasswordEncoder passwordEncoder;

    /**
     * Verifies the plaintext token against the game's stored hash. Returns the game when valid.
     */
    public Game requireGameForIngestToken(@NonNull String gameId, String plaintextToken) {
        if (plaintextToken == null || plaintextToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "missing ingest token");
        }
        Game game = gameRepository
                .findById(gameId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "game not found"));
        String hash = game.getIngestTokenHash();
        if (hash == null || hash.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "ingest token not configured");
        }
        if (!passwordEncoder.matches(plaintextToken.trim(), hash)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid ingest token");
        }
        return game;
    }

    /**
     * Generates a new random token, stores its hash, returns plaintext once.
     */
    @Transactional
    public String regenerateToken(Game game) {
        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        String plaintext = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        String hash = passwordEncoder.encode(plaintext);
        game.setIngestTokenHash(hash);
        game.setIngestTokenCreatedAt(Instant.now());
        gameRepository.save(game);
        return plaintext;
    }

    public boolean hasTokenConfigured(Game game) {
        return game.getIngestTokenHash() != null && !game.getIngestTokenHash().isBlank();
    }
}
