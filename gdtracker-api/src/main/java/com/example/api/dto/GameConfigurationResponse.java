package com.example.api.dto;

import java.util.Map;

public record GameConfigurationResponse(
        Map<String, Boolean> featureFlags,
        Map<String, Object> settings,
        ExceptionTaskTemplateResponse exceptionTaskTemplate) {}
