package com.example.api.util;

import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Validates and normalizes {@code #RRGGBB} hex colors for categories, tags, etc. */
public final class ColorHex {

    private static final Pattern COLOR_HEX = Pattern.compile("#[0-9A-Fa-f]{6}");

    private ColorHex() {}

    public static String validate(String value) {
        if (!COLOR_HEX.matcher(value).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "color must be a #RRGGBB hex value");
        }
        return value.toLowerCase();
    }

    public static String resolveForCreate(String raw, String defaultHex) {
        if (raw == null || raw.isBlank()) {
            return defaultHex;
        }
        return validate(raw.trim());
    }
}
