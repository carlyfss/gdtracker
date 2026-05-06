package com.example.api.security;

import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Identity encoder for local/testing only. Do not use in production.
 */
public final class PlainTextPasswordEncoder {

    private PlainTextPasswordEncoder() {}

    public static PasswordEncoder getInstance() {
        return new PasswordEncoder() {
            @Override
            public String encode(CharSequence rawPassword) {
                return rawPassword.toString();
            }

            @Override
            public boolean matches(CharSequence rawPassword, String encodedPassword) {
                if (rawPassword == null || encodedPassword == null) {
                    return false;
                }
                return rawPassword.toString().equals(encodedPassword);
            }
        };
    }
}
