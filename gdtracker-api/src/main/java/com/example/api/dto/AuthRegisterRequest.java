package com.example.api.dto;

import jakarta.validation.constraints.NotBlank;

public record AuthRegisterRequest(@NotBlank String username, @NotBlank String password) {}
