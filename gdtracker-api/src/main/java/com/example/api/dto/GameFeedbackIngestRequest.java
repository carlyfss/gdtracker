package com.example.api.dto;

import jakarta.validation.constraints.Size;
import java.util.HashMap;
import java.util.Map;

public record GameFeedbackIngestRequest(
        @Size(max = 500, message = "title must be at most 500 characters") String title,
        @Size(max = 20000, message = "description is too long") String description,
        Map<String, Integer> meters) {

    public GameFeedbackIngestRequest {
        title = title != null ? title.trim() : "";
        description = description != null ? description.trim() : "";
        meters = meters == null ? Map.of() : Map.copyOf(new HashMap<>(meters));
    }
}
