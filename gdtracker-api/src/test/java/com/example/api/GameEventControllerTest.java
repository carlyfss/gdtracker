package com.example.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.api.controller.GameEventController;
import com.example.api.model.Game;
import com.example.api.model.GameEvent;
import com.example.api.model.GameEventDefinition;
import com.example.api.model.GamePlayer;
import com.example.api.repository.GameEventRepository;
import com.example.api.service.GameAccessService;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(GameEventController.class)
@AutoConfigureMockMvc(addFilters = false)
class GameEventControllerTest {

    private static final String GAME_ID = "game-test-1";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private GameEventRepository gameEventRepository;

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
    @SuppressWarnings("null")
    void searchGameEvents_shouldReturnPagedResponseWithPlayerId() throws Exception {
        GameEventDefinition definition = new GameEventDefinition();
        definition.setId("def-1");
        definition.setCode("PICKUP");
        definition.setColor("#abcdef");
        definition.setGame(game);

        GamePlayer gp = new GamePlayer();
        gp.setId("player-1");
        gp.setGame(game);

        GameEvent e1 = new GameEvent();
        e1.setId("event-1");
        e1.setGame(game);
        e1.setDefinition(definition);
        e1.setRenderedMessage("Player picked up Sword");
        e1.setGamePlayer(gp);
        e1.setTimestamp(Instant.parse("2026-05-03T12:00:00Z"));

        PageRequest pr = PageRequest.of(0, 10);
        Page<GameEvent> page = new PageImpl<>(java.util.List.<GameEvent>of(e1), pr, 1);

        when(gameEventRepository.searchForGame(eq(GAME_ID), eq(""), eq(""), eq("player-1"), eq(pr))).thenReturn(page);

        mockMvc.perform(get("/api/games/{gameId}/game-events/search", GAME_ID).param("playerId", "player-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].id").value("event-1"))
                .andExpect(jsonPath("$.content[0].playerId").value("player-1"))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.size").value(10));
    }

    @Test
    @SuppressWarnings("null")
    void searchGameEvents_blankPlayerId_shouldTreatAsUnset() throws Exception {
        PageRequest pr = PageRequest.of(0, 10);
        Page<GameEvent> page = new PageImpl<>(java.util.List.<GameEvent>of(), pr, 0);
        when(gameEventRepository.searchForGame(eq(GAME_ID), eq(""), eq(""), eq(""), eq(pr))).thenReturn(page);

        mockMvc.perform(get("/api/games/{gameId}/game-events/search", GAME_ID).param("playerId", "   "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0));
    }
}

