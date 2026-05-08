package com.example.api.security;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final ApiSecurityLoggingHandlers apiSecurityLoggingHandlers;

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http, @Value("${gdtracker.cookie-domain:}") String cookieDomain) throws Exception {
        CookieCsrfTokenRepository tokenRepository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        tokenRepository.setCookiePath("/");
        if (cookieDomain != null && !cookieDomain.isBlank()) {
            tokenRepository.setCookieDomain(cookieDomain);
        }

        CsrfTokenRequestAttributeHandler csrfRequestHandler = new CsrfTokenRequestAttributeHandler();

        http.csrf(csrf -> csrf.csrfTokenRepository(tokenRepository)
                .csrfTokenRequestHandler(csrfRequestHandler)
                .ignoringRequestMatchers(
                        new AntPathRequestMatcher("/api/**", HttpMethod.OPTIONS.name()),
                        new AntPathRequestMatcher("/api/auth/login"),
                        new AntPathRequestMatcher("/api/auth/register"),
                        new AntPathRequestMatcher("/api/games/*/game-players", "POST"),
                        new AntPathRequestMatcher("/api/games/*/game-events/ingest", "POST"),
                        new AntPathRequestMatcher("/api/games/*/game-trace/ingest", "POST"),
                        new AntPathRequestMatcher("/api/games/*/game-exceptions/ingest", "POST"),
                        new AntPathRequestMatcher("/api/games/*/game-feedback/ingest", "POST"),
                        new AntPathRequestMatcher("/api/games/*/integration", "POST")));

        http.cors(Customizer.withDefaults());

        http.authorizeHttpRequests(auth -> auth.requestMatchers(HttpMethod.OPTIONS, "/api/**")
                .permitAll()
                .requestMatchers(HttpMethod.GET, "/api/csrf")
                .permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/login", "/api/auth/register")
                .permitAll()
                .requestMatchers(HttpMethod.GET, "/api/auth/me")
                .permitAll()
                .requestMatchers(new AntPathRequestMatcher("/api/games/*/game-players", "POST"))
                .permitAll()
                .requestMatchers(new AntPathRequestMatcher("/api/games/*/game-events/ingest", "POST"))
                .permitAll()
                .requestMatchers(new AntPathRequestMatcher("/api/games/*/game-trace/ingest", "POST"))
                .permitAll()
                .requestMatchers(new AntPathRequestMatcher("/api/games/*/game-exceptions/ingest", "POST"))
                .permitAll()
                .requestMatchers(new AntPathRequestMatcher("/api/games/*/game-feedback/ingest", "POST"))
                .permitAll()
                .requestMatchers(new AntPathRequestMatcher("/api/games/*/integration", "POST"))
                .permitAll()
                .requestMatchers("/api/auth/logout")
                .authenticated()
                .requestMatchers("/api/**")
                .authenticated()
                .requestMatchers("/error")
                .permitAll()
                .anyRequest()
                .denyAll());

        http.exceptionHandling(ex -> ex.authenticationEntryPoint(apiSecurityLoggingHandlers.authenticationEntryPoint())
                .accessDeniedHandler(apiSecurityLoggingHandlers.accessDeniedHandler()));

        http.formLogin(AbstractHttpConfigurer::disable);
        http.httpBasic(AbstractHttpConfigurer::disable);
        http.logout(AbstractHttpConfigurer::disable);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return PlainTextPasswordEncoder.getInstance();
    }

    @Bean
    @Qualifier("ingestTokenPasswordEncoder")
    public PasswordEncoder ingestTokenPasswordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    /**
     * Prevents Spring Boot from generating a development {@code UserDetails} password; authentication
     * is handled only via {@link com.example.api.controller.AuthController}.
     */
    @Bean
    public UserDetailsService noopUserDetailsService() {
        return username -> {
            throw new UsernameNotFoundException("not used");
        };
    }
}
