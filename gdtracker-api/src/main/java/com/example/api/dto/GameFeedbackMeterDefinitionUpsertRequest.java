package com.example.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GameFeedbackMeterDefinitionUpsertRequest(
        @NotBlank(message = "fieldKey is required") @Size(max = 64, message = "fieldKey must be at most 64 characters")
                String fieldKey,
        @NotBlank(message = "question is required")
                @Size(max = 500, message = "question must be at most 500 characters")
                String question,
        int sortOrder) {

    public GameFeedbackMeterDefinitionUpsertRequest {
        fieldKey = normalizeFieldKey(fieldKey);
        question = question != null ? question.trim() : "";
    }

    private static String normalizeFieldKey(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.trim().toLowerCase().replace(' ', '_');
    }
}
