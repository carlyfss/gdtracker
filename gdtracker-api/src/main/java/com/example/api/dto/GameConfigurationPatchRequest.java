package com.example.api.dto;

import java.util.HashMap;
import java.util.Map;

public record GameConfigurationPatchRequest(
        Map<String, Boolean> featureFlags, Map<String, Object> settings, String defaultExceptionTaskCategoryId) {

    public GameConfigurationPatchRequest {
        if (featureFlags == null) {
            featureFlags = Map.of();
        }
        if (settings == null) {
            settings = Map.of();
        }
        featureFlags = Map.copyOf(sanitizeFlags(featureFlags));
        settings = Map.copyOf(settings);
    }

    private static Map<String, Boolean> sanitizeFlags(Map<String, Boolean> raw) {
        Map<String, Boolean> out = new HashMap<>();
        for (var e : raw.entrySet()) {
            if (e.getKey() == null || e.getKey().isBlank()) {
                continue;
            }
            Boolean v = e.getValue();
            if (v == null) {
                continue;
            }
            out.put(e.getKey().trim(), v);
        }
        return out;
    }
}
