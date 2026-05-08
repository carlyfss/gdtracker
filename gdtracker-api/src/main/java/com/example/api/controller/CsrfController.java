package com.example.api.controller;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/csrf")
public class CsrfController {

    @GetMapping
    public ResponseEntity<Map<String, String>> csrf(CsrfToken token) {
        // Returning the token avoids relying on cross-subdomain document.cookie access in the SPA.
        return ResponseEntity.ok(Map.of("token", token.getToken()));
    }
}
