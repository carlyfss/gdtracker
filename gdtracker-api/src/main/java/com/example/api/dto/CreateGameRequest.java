package com.example.api.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateGameRequest(@NotBlank String name) {}
