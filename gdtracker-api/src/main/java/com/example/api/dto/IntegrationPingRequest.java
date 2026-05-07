package com.example.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record IntegrationPingRequest(
        @NotBlank(message = "validation is required") @Pattern(regexp = "^ok$", message = "validation must be \"ok\"")
                String validation) {

    public IntegrationPingRequest {
        validation = validation != null ? validation.trim() : "";
    }
}
