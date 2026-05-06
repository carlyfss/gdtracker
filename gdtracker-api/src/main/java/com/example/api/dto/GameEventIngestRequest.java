package com.example.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.HashMap;
import java.util.Map;

public record GameEventIngestRequest(
        @NotBlank(message = "definition code is required") @Size(max = 64) String definitionCode,
        Map<String, String> parameters) {

    public GameEventIngestRequest {
        definitionCode = definitionCode != null ? definitionCode.trim().toLowerCase() : "";
        parameters = parameters != null ? new HashMap<>(parameters) : Map.of();
    }
}
