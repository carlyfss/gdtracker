package com.example.api.controller;

import com.example.api.dto.CreateGameRequest;
import com.example.api.dto.GameSummaryResponse;
import com.example.api.model.Game;
import com.example.api.model.User;
import com.example.api.repository.GameRepository;
import com.example.api.repository.UserRepository;
import com.example.api.service.GameAccessService;
import com.example.api.service.GameSetupService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/games")
@RequiredArgsConstructor
public class GameController {

    private final GameRepository gameRepository;
    private final UserRepository userRepository;
    private final GameAccessService gameAccessService;
    private final GameSetupService gameSetupService;

    @GetMapping
    public ResponseEntity<List<GameSummaryResponse>> listGames(Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        List<GameSummaryResponse> list = gameRepository.findByOwnerIdOrderByNameAsc(userId).stream()
                .map(g -> new GameSummaryResponse(g.getId(), g.getName()))
                .toList();
        return ResponseEntity.ok(list);
    }

    @PostMapping
    public ResponseEntity<GameSummaryResponse> createGame(
            @Valid @RequestBody CreateGameRequest request, Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        User owner = userRepository
                .findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "user not found"));
        Game game = new Game(request.name().trim(), owner);
        Game saved = gameRepository.save(game);
        gameSetupService.ensureGameBootstrap(saved);
        return ResponseEntity.status(HttpStatus.CREATED).body(new GameSummaryResponse(saved.getId(), saved.getName()));
    }
}
