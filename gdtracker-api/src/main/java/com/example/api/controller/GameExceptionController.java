package com.example.api.controller;

import com.example.api.dto.ReserveExceptionTaskIndexResponse;
import com.example.api.model.Game;
import com.example.api.model.GameException;
import com.example.api.repository.GameExceptionRepository;
import com.example.api.service.GameAccessService;
import com.example.api.service.GameExceptionTaskSequenceService;
import java.time.Instant;
import java.util.List;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/games/{gameId}/game-exceptions")
@RequiredArgsConstructor
public class GameExceptionController {

    private static final int DEFAULT_SEARCH_SIZE = 10;
    private static final int MAX_SEARCH_SIZE = 100;

    private final GameExceptionRepository gameExceptionRepository;
    private final GameExceptionTaskSequenceService gameExceptionTaskSequenceService;
    private final GameAccessService gameAccessService;

    @GetMapping
    public ResponseEntity<List<GameException>> listGameExceptions(
            @PathVariable("gameId") @NonNull String gameId, Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        return ResponseEntity.ok(gameExceptionRepository.findByGameIdOrderByTimestampDesc(gameId));
    }

    @GetMapping("/interval")
    public ResponseEntity<List<GameException>> listGameExceptionsInInterval(
            @PathVariable("gameId") @NonNull String gameId,
            @RequestParam("fromMs") long fromMs,
            @RequestParam("toMs") long toMs,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        if (fromMs >= toMs) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "fromMs must be < toMs");
        }

        Instant from = Instant.ofEpochMilli(fromMs);
        Instant to = Instant.ofEpochMilli(toMs);
        return ResponseEntity.ok(
                gameExceptionRepository.findByGameIdAndTimestampBetweenOrderByTimestampDesc(gameId, from, to));
    }

    @GetMapping("/search")
    public ResponseEntity<Page<GameException>> searchGameExceptions(
            @PathVariable("gameId") @NonNull String gameId,
            @RequestParam(value = "q", required = false) String q,
            @RequestParam(value = "page", required = false, defaultValue = "0") int page,
            @RequestParam(value = "size", required = false, defaultValue = "10") int size,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);

        int effectiveSize = size <= 0 ? DEFAULT_SEARCH_SIZE : Math.min(MAX_SEARCH_SIZE, size);
        int effectivePage = Math.max(0, page);
        String qParam = q == null || q.isBlank() ? "" : q.trim();

        return ResponseEntity.ok(
                gameExceptionRepository.searchForGame(gameId, qParam, PageRequest.of(effectivePage, effectiveSize)));
    }

    @GetMapping("/{exceptionId}")
    public ResponseEntity<GameException> getGameException(
            @PathVariable("gameId") @NonNull String gameId,
            @PathVariable("exceptionId") @NonNull String exceptionId,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        GameException ex = gameExceptionRepository
                .findByIdAndGameId(exceptionId, gameId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "game exception not found"));
        return ResponseEntity.ok(ex);
    }

    @PostMapping("/{exceptionId}/reserve-task-index")
    public ResponseEntity<ReserveExceptionTaskIndexResponse> reserveExceptionTaskIndex(
            @PathVariable("gameId") @NonNull String gameId,
            @PathVariable("exceptionId") @NonNull String exceptionId,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        gameExceptionRepository
                .findByIdAndGameId(exceptionId, gameId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "game exception not found"));
        int index = gameExceptionTaskSequenceService.reserveNextIndexForGame(gameId);
        return ResponseEntity.ok(new ReserveExceptionTaskIndexResponse(index));
    }

    @PostMapping
    public ResponseEntity<GameException> reportGameException(
            @PathVariable("gameId") @NonNull String gameId,
            @RequestBody @NonNull GameException gameException,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        Game game = gameAccessService.requireOwnedGame(gameId, userId);
        gameException.setGame(game);
        GameException saved = gameExceptionRepository.save(gameException);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }
}
