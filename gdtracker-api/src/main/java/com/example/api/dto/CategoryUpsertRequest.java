package com.example.api.dto;

import jakarta.validation.constraints.NotBlank;

public record CategoryUpsertRequest(@NotBlank(message = "name is required") String name, String color) {

    public CategoryUpsertRequest {
        name = normalizeWhitespaceName(name);
        if (color != null && !color.isBlank()) {
            color = color.trim();
        }
    }

    private static String normalizeWhitespaceName(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.trim().replaceAll("\\s+", " ");
    }
}
