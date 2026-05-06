package com.example.api.controller;

import com.example.api.dto.AuthLoginRequest;
import com.example.api.dto.AuthRegisterRequest;
import com.example.api.dto.UserResponse;
import com.example.api.model.User;
import com.example.api.repository.UserRepository;
import com.example.api.security.AppUserPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final SecurityContextRepository securityContextRepository;

    @PostMapping("/register")
    public ResponseEntity<UserResponse> register(
            @Valid @RequestBody AuthRegisterRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        if (userRepository.existsByUsernameIgnoreCase(request.username())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "username already exists");
        }
        User user = new User(request.username().trim(), passwordEncoder.encode(request.password()));
        User saved = userRepository.save(user);
        establishSession(saved, httpRequest, httpResponse);
        return ResponseEntity.status(HttpStatus.CREATED).body(new UserResponse(saved.getId(), saved.getUsername()));
    }

    @PostMapping("/login")
    public ResponseEntity<UserResponse> login(
            @Valid @RequestBody AuthLoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        User user = userRepository
                .findByUsernameIgnoreCase(request.username().trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid credentials"));
        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid credentials");
        }
        establishSession(user, httpRequest, httpResponse);
        return ResponseEntity.ok(new UserResponse(user.getId(), user.getUsername()));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        AuthenticationFacade.clearIfPresent(request, response);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> me() {
        SecurityContext context = SecurityContextHolder.getContext();
        if (context.getAuthentication() == null || !context.getAuthentication().isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Object principal = context.getAuthentication().getPrincipal();
        if (!(principal instanceof AppUserPrincipal appUserPrincipal)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(new UserResponse(appUserPrincipal.getUserId(), appUserPrincipal.getUsername()));
    }

    private void establishSession(User user, HttpServletRequest request, HttpServletResponse response) {
        AppUserPrincipal principal = new AppUserPrincipal(user.getId(), user.getUsername());
        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
    }

    private static final class AuthenticationFacade {
        private AuthenticationFacade() {}

        static void clearIfPresent(HttpServletRequest request, HttpServletResponse response) {
            var auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null) {
                new SecurityContextLogoutHandler().logout(request, response, auth);
            }
            SecurityContextHolder.clearContext();
        }
    }
}
