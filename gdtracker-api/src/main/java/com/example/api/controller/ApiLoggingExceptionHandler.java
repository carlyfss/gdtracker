package com.example.api.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

/**
 * Logs API exceptions. Runs at lower precedence than {@link ValidationExceptionHandler} so validation
 * handling stays unchanged.
 */
@RestControllerAdvice
@Order(Ordered.LOWEST_PRECEDENCE)
public class ApiLoggingExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiLoggingExceptionHandler.class);

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Void> logResponseStatus(ResponseStatusException ex, HttpServletRequest request) {
        log.warn(
                "HTTP {} {} — {}",
                ex.getStatusCode().value(),
                request.getRequestURI(),
                ex.getReason() != null ? ex.getReason() : "");
        return ResponseEntity.status(ex.getStatusCode()).build();
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Void> logUnexpected(Exception ex, HttpServletRequest request) {
        log.error("Unhandled exception {} {}", request.getMethod(), request.getRequestURI(), ex);
        return ResponseEntity.internalServerError().build();
    }
}
