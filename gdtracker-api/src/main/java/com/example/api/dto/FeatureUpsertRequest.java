package com.example.api.dto;

import com.example.api.model.TaskStatus;
import jakarta.validation.constraints.NotBlank;

public record FeatureUpsertRequest(
        @NotBlank(message = "name is required") String name,
        String description,
        TaskStatus status,
        String color,
        String parentId) {

    public FeatureUpsertRequest {
        name = normalizeWhitespaceName(name);
        description = normalizeDescription(description);
        if (color != null && !color.isBlank()) {
            color = color.trim();
        }
        if (parentId != null && parentId.isBlank()) {
            parentId = null;
        }
    }

    private static String normalizeWhitespaceName(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.trim().replaceAll("\\s+", " ");
    }

    private static String normalizeDescription(String raw) {
        if (raw == null) {
            return null;
        }
        String t = raw.trim();
        return t.isEmpty() ? null : t;
    }
}
