package com.example.api.security;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

@Component
public class ApiSecurityLoggingHandlers {

    private static final Logger log = LoggerFactory.getLogger(ApiSecurityLoggingHandlers.class);

    public AccessDeniedHandler accessDeniedHandler() {
        return (request, response, accessDeniedException) -> {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            boolean authenticated = auth != null && auth.isAuthenticated();
            log.warn(
                    "Access denied {} {} — {} (authenticated={}, principalType={})",
                    request.getMethod(),
                    request.getRequestURI(),
                    accessDeniedException.getClass().getSimpleName() + ": " + accessDeniedException.getMessage(),
                    authenticated,
                    auth != null ? auth.getPrincipal().getClass().getSimpleName() : "none");
            writeJson(response, HttpServletResponse.SC_FORBIDDEN);
        };
    }

    public AuthenticationEntryPoint authenticationEntryPoint() {
        return (request, response, authException) -> {
            log.warn(
                    "Unauthorized {} {} — {}",
                    request.getMethod(),
                    request.getRequestURI(),
                    authException.getClass().getSimpleName() + ": " + authException.getMessage());
            writeJson(response, HttpServletResponse.SC_UNAUTHORIZED);
        };
    }

    private static void writeJson(HttpServletResponse response, int status) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("{}");
    }
}
