package com.example.api.controller;

import com.example.api.dto.FeatureTaskProgressRow;
import com.example.api.dto.FeatureUpsertRequest;
import com.example.api.model.Feature;
import com.example.api.service.FeatureService;
import com.example.api.service.FeatureTaskProgressService;
import com.example.api.service.GameAccessService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games/{gameId}/features")
@RequiredArgsConstructor
public class FeatureController {

    private final FeatureService featureService;
    private final FeatureTaskProgressService featureTaskProgressService;
    private final GameAccessService gameAccessService;

    @GetMapping
    public ResponseEntity<List<Feature>> listFeatures(
            @PathVariable("gameId") String gameId,
            @RequestParam(name = "archived", required = false, defaultValue = "false") boolean archived,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        return ResponseEntity.ok(featureService.listFeatures(gameId, userId, archived));
    }

    @GetMapping("/task-progress")
    public ResponseEntity<List<FeatureTaskProgressRow>> taskProgress(
            @PathVariable("gameId") String gameId,
            @RequestParam(name = "archived", required = false, defaultValue = "false") boolean archived,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        return ResponseEntity.ok(featureTaskProgressService.progressForGame(gameId, userId, archived));
    }

    @PostMapping("/{id}/archive")
    public ResponseEntity<Void> archiveFeature(
            @PathVariable("gameId") String gameId, @PathVariable("id") String id, Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        featureService.archiveFeature(gameId, userId, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping
    public ResponseEntity<Feature> createFeature(
            @PathVariable("gameId") String gameId,
            @Valid @RequestBody FeatureUpsertRequest req,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        Feature saved = featureService.createFeature(gameId, userId, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Feature> updateFeature(
            @PathVariable("gameId") String gameId,
            @PathVariable("id") String id,
            @Valid @RequestBody FeatureUpsertRequest req,
            Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        return ResponseEntity.ok(featureService.updateFeature(gameId, userId, id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFeature(
            @PathVariable("gameId") String gameId, @PathVariable("id") String id, Authentication authentication) {
        String userId = gameAccessService.requireUserId(authentication);
        featureService.deleteFeature(gameId, userId, id);
        return ResponseEntity.noContent().build();
    }
}
