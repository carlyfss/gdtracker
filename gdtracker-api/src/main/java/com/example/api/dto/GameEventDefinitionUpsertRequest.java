package com.example.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GameEventDefinitionUpsertRequest(
        @NotBlank(message = "code is required") @Size(max = 64, message = "code must be at most 64 characters")
                String code,
        @Size(max = 255, message = "display name must be at most 255 characters") String displayName,
        @NotBlank(message = "message template is required")
                @Size(max = 100, message = "message template must be at most 100 characters")
                String messageTemplate,
        String imageData,
        String color) {

    public GameEventDefinitionUpsertRequest {
        code = normalizeCode(code);
        displayName = normalizeNullable(displayName);
        messageTemplate = messageTemplate != null ? messageTemplate.trim() : "";
        if (imageData != null && imageData.isBlank()) {
            imageData = null;
        }
        if (color != null && color.isBlank()) {
            color = null;
        } else if (color != null) {
            color = color.trim();
        }
    }

    private static String normalizeCode(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.trim().toLowerCase().replace(' ', '_');
    }

    private static String normalizeNullable(String raw) {
        if (raw == null) {
            return null;
        }
        String t = raw.trim();
        return t.isEmpty() ? null : t;
    }
}
