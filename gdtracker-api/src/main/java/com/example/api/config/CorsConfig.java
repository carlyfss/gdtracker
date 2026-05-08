package com.example.api.config;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Credentialed browser calls when the SPA and API use different origins (e.g. Docker Compose).
 *
 * @see CorsConfiguration#setAllowCredentials(Boolean)
 * @see CorsConfiguration#setAllowedOriginPatterns(java.util.List)
 */
@Configuration
public class CorsConfig {

    /**
     * Comma-separated list of origin patterns ({@link CorsConfiguration#setAllowedOriginPatterns}).
     * Use literal origins like {@code http://localhost:5173}; wildcard patterns are discouraged with credentials
     * unless you trust the match breadth. Never use bare {@code *}. Environment variable:
     * {@code GDTRACKER_CORS_ALLOWED_ORIGINS}; default is only in {@code application.properties}.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${gdtracker.cors.allowed-origins}") String allowedOrigins) {
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
        if (origins.isEmpty()) {
            origins = List.of("http://localhost:5173");
        }

        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(origins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }
}
