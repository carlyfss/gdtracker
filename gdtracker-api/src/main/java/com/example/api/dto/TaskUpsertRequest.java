package com.example.api.dto;

import com.example.api.model.TaskStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.LinkedHashSet;
import java.util.List;

public record TaskUpsertRequest(
        @NotBlank(message = "title is required") String title,
        String description,
        @NotNull(message = "status is required") TaskStatus status,
        @NotBlank(message = "featureId is required") String featureId,
        String categoryId,
        List<String> tagIds,
        String parentTaskId,
        String sourceGameExceptionId) {

    public TaskUpsertRequest {
        title = normalizeWhitespaceTitle(title);
        featureId = featureId == null ? "" : featureId.trim();
        categoryId = normalizeOptionalId(categoryId);
        parentTaskId = normalizeOptionalId(parentTaskId);
        if (tagIds != null) {
            tagIds = normalizeTagIds(tagIds);
        }
        if (sourceGameExceptionId != null) {
            sourceGameExceptionId = sourceGameExceptionId.trim();
        }
    }

    private static String normalizeOptionalId(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return raw.trim();
    }

    private static String normalizeWhitespaceTitle(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.trim().replaceAll("\\s+", " ");
    }

    private static List<String> normalizeTagIds(List<String> raw) {
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String s : raw) {
            if (s == null || s.isBlank()) {
                continue;
            }
            unique.add(s.trim());
        }
        return List.copyOf(unique);
    }

    /** Null when the client omitted {@code tagIds} (PUT: do not replace associations). */
    public List<String> tagIdsOrNull() {
        return tagIds;
    }
}
