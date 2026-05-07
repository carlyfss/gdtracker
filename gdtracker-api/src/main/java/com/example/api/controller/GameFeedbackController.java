package com.example.api.controller;

import com.example.api.dto.GameFeedbackDetailResponse;
import com.example.api.dto.GameFeedbackSummaryResponse;
import com.example.api.service.GameAccessService;
import com.example.api.service.GameFeedbackQueryService;
import java.util.List;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games/{gameId}/game-feedback")
@RequiredArgsConstructor
public class GameFeedbackController {

    private final GameAccessService gameAccessService;
    private final GameFeedbackQueryService gameFeedbackQueryService;

    @GetMapping
    public ResponseEntity<List<GameFeedbackSummaryResponse>> list(
            @PathVariable("gameId") @NonNull String gameId, Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        return ResponseEntity.ok(gameFeedbackQueryService.listSummaries(gameId));
    }

    @GetMapping("/{feedbackId}")
    public ResponseEntity<GameFeedbackDetailResponse> getOne(
            @PathVariable("gameId") @NonNull String gameId,
            @PathVariable("feedbackId") @NonNull String feedbackId,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        gameAccessService.requireOwnedGame(gameId, userId);
        return ResponseEntity.ok(gameFeedbackQueryService.getDetail(gameId, feedbackId));
    }
}
