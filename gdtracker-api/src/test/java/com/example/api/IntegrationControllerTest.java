package com.example.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.api.controller.IntegrationController;
import com.example.api.model.Game;
import com.example.api.model.User;
import com.example.api.security.AppUserPrincipal;
import com.example.api.service.GameAccessService;
import com.example.api.service.IntegrationPingService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(IntegrationController.class)
@AutoConfigureMockMvc(addFilters = false)
class IntegrationControllerTest {

    private static final String GAME_ID = "game-integration-1";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private IntegrationPingService integrationPingService;

    @MockBean
    private GameAccessService gameAccessService;

    @Test
    void ping_withoutAuthorization_shouldReturnUnauthorized() throws Exception {
        mockMvc.perform(post("/api/games/{gameId}/integration", GAME_ID)
                        .contentType(MediaType.APPLICATION_JSON_VALUE)
                        .content("{\"validation\":\"ok\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void ping_withNonBearerScheme_shouldReturnUnauthorized() throws Exception {
        mockMvc.perform(post("/api/games/{gameId}/integration", GAME_ID)
                        .header("Authorization", "Basic dXNlcjpwYXNz")
                        .contentType(MediaType.APPLICATION_JSON_VALUE)
                        .content("{\"validation\":\"ok\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void ping_invalidValidation_shouldReturnBadRequest() throws Exception {
        mockMvc.perform(post("/api/games/{gameId}/integration", GAME_ID)
                        .header("Authorization", "Bearer plain-token")
                        .contentType(MediaType.APPLICATION_JSON_VALUE)
                        .content("{\"validation\":\"no\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void ping_valid_shouldReturnNoContentAndCallService() throws Exception {
        doNothing().when(integrationPingService).recordPing(eq(GAME_ID), eq("plain-token"));

        mockMvc.perform(post("/api/games/{gameId}/integration", GAME_ID)
                        .header("Authorization", "Bearer plain-token")
                        .contentType(MediaType.APPLICATION_JSON_VALUE)
                        .content("{\"validation\":\"ok\"}"))
                .andExpect(status().isNoContent());

        verify(integrationPingService).recordPing(GAME_ID, "plain-token");
    }

    @Test
    void status_authenticated_returnsLastValidatedAt() throws Exception {
        User owner = new User("u@example.com", "pw");
        owner.setId("uid");
        Game game = new Game("G", owner);
        game.setLastIntegrationValidationAt(Instant.parse("2026-06-01T10:00:00Z"));

        when(gameAccessService.requireUserId(any())).thenReturn("uid");
        when(gameAccessService.requireOwnedGame(GAME_ID, "uid")).thenReturn(game);

        var principal = new AppUserPrincipal("uid", "alice");
        var auth = new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));

        mockMvc.perform(get("/api/games/{gameId}/integration/status", GAME_ID).with(authentication(auth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastValidatedAt").value("2026-06-01T10:00:00Z"));
    }
}
