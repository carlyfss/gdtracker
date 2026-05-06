package com.example.api.security;

import java.io.Serializable;
import lombok.Getter;
import org.springframework.security.core.userdetails.UserDetails;

/**
 * Minimal principal stored in the HTTP session after login.
 */
@Getter
public class AppUserPrincipal implements UserDetails, Serializable {

    private final String userId;
    private final String username;

    public AppUserPrincipal(String userId, String username) {
        this.userId = userId;
        this.username = username;
    }

    @Override
    public java.util.Collection<org.springframework.security.core.GrantedAuthority> getAuthorities() {
        return java.util.List.of(() -> "ROLE_USER");
    }

    @Override
    public String getPassword() {
        return "";
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}
