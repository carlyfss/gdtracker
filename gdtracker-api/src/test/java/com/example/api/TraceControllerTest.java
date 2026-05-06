package com.example.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.api.controller.TraceController;
import com.example.api.model.Game;
import com.example.api.model.GameEvent;
import com.example.api.model.GameEventDefinition;
import com.example.api.model.GameEventTrace;
import com.example.api.repository.GameEventTraceRepository;
import com.example.api.service.GameAccessService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(TraceController.class)
@AutoConfigureMockMvc(addFilters = false)
class TraceControllerTest {

    private static final String GAME_ID = "game-test-1";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private GameEventTraceRepository gameEventTraceRepository;

    @MockBean
    private GameAccessService gameAccessService;

    private Game game;

    @BeforeEach
    void stubGameAccess() {
        game = new Game();
        game.setId(GAME_ID);
        when(gameAccessService.requireUserId(any())).thenReturn("user-1");
        when(gameAccessService.requireOwnedGame(eq(GAME_ID), anyString())).thenReturn(game);
    }

    @Test
    void getTraces_shouldReturnOkWithEventInfo() throws Exception {
        GameEventDefinition definition = new GameEventDefinition();
        definition.setId("def-1");
        definition.setCode("PICKUP");
        definition.setColor("#abcdef");
        definition.setGame(game);

        GameEvent event = new GameEvent();
        event.setId("event-1");
        event.setGame(game);
        event.setDefinition(definition);
        event.setRenderedMessage("Player picked up Sword");

        GameEventTrace t1 = new GameEventTrace("SpawnPoint", "Map1");
        t1.setId("id-1");
        t1.setGame(game);
        t1.setGameEvent(event);
        t1.setTimestamp(Instant.parse("2026-05-03T12:00:00Z"));

        GameEventTrace t2 = new GameEventTrace("TreasureRoom", "Map2");
        t2.setId("id-2");
        t2.setGame(game);
        t2.setTimestamp(Instant.parse("2026-05-03T12:01:00Z"));

        when(gameEventTraceRepository.findByGameIdOrderByTimestampDesc(GAME_ID)).thenReturn(List.of(t1, t2));

        mockMvc.perform(get("/api/games/{gameId}/game-trace", GAME_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value("id-1"))
                .andExpect(jsonPath("$[0].location").value("SpawnPoint"))
                .andExpect(jsonPath("$[0].gameEventId").value("event-1"))
                .andExpect(jsonPath("$[0].renderedMessage").value("Player picked up Sword"))
                .andExpect(jsonPath("$[0].definitionCode").value("PICKUP"))
                .andExpect(jsonPath("$[0].definitionColor").value("#abcdef"))
                .andExpect(jsonPath("$[1].id").value("id-2"))
                .andExpect(jsonPath("$[1].location").value("TreasureRoom"))
                .andExpect(jsonPath("$[1].gameEventId").doesNotExist());
    }

    @Test
    void getTraces_emptyList_shouldReturnOk() throws Exception {
        when(gameEventTraceRepository.findByGameIdOrderByTimestampDesc(GAME_ID)).thenReturn(List.of());

        mockMvc.perform(get("/api/games/{gameId}/game-trace", GAME_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }
}
