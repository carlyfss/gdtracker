package com.example.api.service;

import com.example.api.model.Game;
import com.example.api.repository.GameRepository;
import com.example.api.security.AppUserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class GameAccessService {

    private final GameRepository gameRepository;

    public String requireUserId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "not authenticated");
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof AppUserPrincipal appUserPrincipal) {
            return appUserPrincipal.getUserId();
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "not authenticated");
    }

    public Game requireOwnedGame(String gameId, String userId) {
        return gameRepository
                .findByIdAndOwnerId(gameId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "game not found"));
    }
}
