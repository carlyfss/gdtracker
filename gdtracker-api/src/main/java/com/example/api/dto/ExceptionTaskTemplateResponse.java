package com.example.api.dto;

public record ExceptionTaskTemplateResponse(
        String titleTemplate,
        String descriptionTemplate,
        String defaultCategoryId,
        CategorySummaryResponse defaultCategory) {}
