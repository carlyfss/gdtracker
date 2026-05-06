package com.example.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.api.controller.GameExceptionController;
import com.example.api.model.Game;
import com.example.api.model.GameException;
import com.example.api.repository.GameExceptionRepository;
import com.example.api.service.GameAccessService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(GameExceptionController.class)
@AutoConfigureMockMvc(addFilters = false)
class GameExceptionControllerTest {

    private static final String GAME_ID = "game-test-1";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private GameExceptionRepository gameExceptionRepository;

    @MockBean
    private GameAccessService gameAccessService;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void stubGameAccess() {
        Game game = new Game();
        game.setId(GAME_ID);
        when(gameAccessService.requireUserId(any())).thenReturn("user-1");
        when(gameAccessService.requireOwnedGame(eq(GAME_ID), anyString())).thenReturn(game);
    }

    @Test
    @SuppressWarnings("null")
    void reportGameException_shouldReturnCreated() throws Exception {
        GameException gameException = new GameException("NullPointerException", "Level1-3", "DungeonMap");
        gameException.setId("test-uuid-123");

        when(gameExceptionRepository.save(any(GameException.class))).thenReturn(gameException);

        mockMvc.perform(post("/api/games/{gameId}/game-exceptions", GAME_ID)
                        .contentType(MediaType.APPLICATION_JSON_VALUE)
                        .content(objectMapper.writeValueAsString(gameException)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("test-uuid-123"))
                .andExpect(jsonPath("$.errorMessage").value("NullPointerException"))
                .andExpect(jsonPath("$.location").value("Level1-3"))
                .andExpect(jsonPath("$.map").value("DungeonMap"));
    }

    @Test
    @SuppressWarnings("null")
    void reportGameException_withNullFields_shouldReturnCreated() throws Exception {
        GameException gameException = new GameException(null, null, null);
        gameException.setId("uuid-456");

        when(gameExceptionRepository.save(any(GameException.class))).thenReturn(gameException);

        mockMvc.perform(post("/api/games/{gameId}/game-exceptions", GAME_ID)
                        .contentType(MediaType.APPLICATION_JSON_VALUE)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("uuid-456"));
    }

    @Test
    void listGameExceptions_shouldReturnOk() throws Exception {
        GameException e1 = new GameException("E1", "L1", "M1");
        e1.setId("id-1");
        GameException e2 = new GameException("E2", "L2", "M2");
        e2.setId("id-2");

        when(gameExceptionRepository.findByGameIdOrderByTimestampDesc(GAME_ID)).thenReturn(List.of(e1, e2));

        mockMvc.perform(get("/api/games/{gameId}/game-exceptions", GAME_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value("id-1"))
                .andExpect(jsonPath("$[1].id").value("id-2"));
    }
}
