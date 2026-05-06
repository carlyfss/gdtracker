package com.example.api.dto;

public record FeatureTaskProgressRow(
        String featureId, long totalDirect, long doneDirect, long rolledUpTotal, long rolledUpDone) {}
