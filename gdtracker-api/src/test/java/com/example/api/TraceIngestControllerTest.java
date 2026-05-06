package com.example.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.api.controller.TraceIngestController;
import com.example.api.dto.GameEventTraceCreateRequest;
import com.example.api.dto.GameEventTraceResponse;
import com.example.api.service.TraceIngestService;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

@WebMvcTest(TraceIngestController.class)
@AutoConfigureMockMvc(addFilters = false)
class TraceIngestControllerTest {

    private static final String GAME_ID = "game-test-1";
    private static final String VALID_BODY = "{\"location\":\"(35, 22, 17)\",\"map\":\"proto-dungeon\"}";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TraceIngestService traceIngestService;

    @Test
    void ingest_withoutAuthorization_shouldReturnUnauthorized() throws Exception {
        mockMvc.perform(post("/api/games/{gameId}/game-trace/ingest", GAME_ID)
                        .contentType(MediaType.APPLICATION_JSON_VALUE)
                        .content(VALID_BODY))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void ingest_withNonBearerScheme_shouldReturnUnauthorized() throws Exception {
        mockMvc.perform(post("/api/games/{gameId}/game-trace/ingest", GAME_ID)
                        .header("Authorization", "Basic dXNlcjpwYXNz")
                        .contentType(MediaType.APPLICATION_JSON_VALUE)
                        .content(VALID_BODY))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @SuppressWarnings("null")
    void ingest_validBearer_shouldReturnCreated() throws Exception {
        GameEventTraceResponse response = new GameEventTraceResponse(
                "trace-1",
                "(35, 22, 17)",
                "proto-dungeon",
                Instant.parse("2026-05-03T12:00:00Z"),
                "event-1",
                "Player 123 died to Zombie at proto-dungeon:(35, 22, 17)",
                "DEATH",
                "#ff0000");

        when(traceIngestService.ingest(eq(GAME_ID), eq("plain-token"), any(GameEventTraceCreateRequest.class)))
                .thenReturn(response);

        String body = "{\"location\":\"(35, 22, 17)\",\"map\":\"proto-dungeon\",\"gameEventId\":\"event-1\"}";

        mockMvc.perform(post("/api/games/{gameId}/game-trace/ingest", GAME_ID)
                        .header("Authorization", "Bearer plain-token")
                        .contentType(MediaType.APPLICATION_JSON_VALUE)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("trace-1"))
                .andExpect(jsonPath("$.location").value("(35, 22, 17)"))
                .andExpect(jsonPath("$.map").value("proto-dungeon"))
                .andExpect(jsonPath("$.gameEventId").value("event-1"))
                .andExpect(
                        jsonPath("$.renderedMessage").value("Player 123 died to Zombie at proto-dungeon:(35, 22, 17)"))
                .andExpect(jsonPath("$.definitionCode").value("DEATH"))
                .andExpect(jsonPath("$.definitionColor").value("#ff0000"));
    }

    @Test
    @SuppressWarnings("null")
    void ingest_serviceThrowsBadRequest_shouldReturnBadRequest() throws Exception {
        when(traceIngestService.ingest(eq(GAME_ID), eq("plain-token"), any(GameEventTraceCreateRequest.class)))
                .thenThrow(
                        new ResponseStatusException(HttpStatus.BAD_REQUEST, "game event does not belong to this game"));

        String body = "{\"location\":\"(1, 2, 3)\",\"map\":\"map-a\",\"gameEventId\":\"event-foreign\"}";

        mockMvc.perform(post("/api/games/{gameId}/game-trace/ingest", GAME_ID)
                        .header("Authorization", "Bearer plain-token")
                        .contentType(MediaType.APPLICATION_JSON_VALUE)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    @SuppressWarnings("null")
    void ingest_serviceThrowsNotFound_shouldReturnNotFound() throws Exception {
        when(traceIngestService.ingest(eq(GAME_ID), eq("plain-token"), any(GameEventTraceCreateRequest.class)))
                .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "game event not found"));

        String body = "{\"location\":\"(1, 2, 3)\",\"map\":\"map-a\",\"gameEventId\":\"missing-event\"}";

        mockMvc.perform(post("/api/games/{gameId}/game-trace/ingest", GAME_ID)
                        .header("Authorization", "Bearer plain-token")
                        .contentType(MediaType.APPLICATION_JSON_VALUE)
                        .content(body))
                .andExpect(status().isNotFound());
    }
}
