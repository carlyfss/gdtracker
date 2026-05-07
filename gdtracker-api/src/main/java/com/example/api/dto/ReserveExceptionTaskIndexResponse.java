package com.example.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ReserveExceptionTaskIndexResponse(@JsonProperty("index") int index) {}
