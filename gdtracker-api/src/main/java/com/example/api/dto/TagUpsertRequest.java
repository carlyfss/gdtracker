package com.example.api.dto;

import jakarta.validation.constraints.NotBlank;

public record TagUpsertRequest(@NotBlank(message = "name is required") String name, String color, String description) {

    public TagUpsertRequest {
        name = normalizeWhitespaceName(name);
        if (color != null && !color.isBlank()) {
            color = color.trim();
        }
        if (description != null && !description.isBlank()) {
            description = description.trim();
        } else {
            description = null;
        }
    }

    private static String normalizeWhitespaceName(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.trim().replaceAll("\\s+", " ");
    }
}
