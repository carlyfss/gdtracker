package com.example.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.api.dto.GameExceptionIngestRequest;
import com.example.api.model.Game;
import com.example.api.model.GameException;
import com.example.api.model.GamePlayer;
import com.example.api.repository.GameExceptionRepository;
import com.example.api.service.GameExceptionIngestService;
import com.example.api.service.GameIngestTokenService;
import com.example.api.service.GamePlayerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class GameExceptionIngestServiceTest {

    private static final String GAME_ID = "g1";
    private static final String TOKEN = "tok";
    private static final String PID = "p1";

    @Mock
    private GameIngestTokenService gameIngestTokenService;

    @Mock
    private GamePlayerService gamePlayerService;

    @Mock
    private GameExceptionRepository gameExceptionRepository;

    @InjectMocks
    private GameExceptionIngestService service;

    private Game game;
    private GamePlayer player;

    @BeforeEach
    void setUp() {
        game = new Game();
        game.setId(GAME_ID);
        player = new GamePlayer(game);
        player.setId(PID);
        when(gameIngestTokenService.requireGameForIngestToken(GAME_ID, TOKEN)).thenReturn(game);
        when(gamePlayerService.requirePlayerForIngest(GAME_ID, PID)).thenReturn(player);
    }

    @Test
    void ingest_persistsShortErrorMessage() {
        GameException saved = new GameException("full", "loc", "map");
        saved.setId("ex-1");
        saved.setShortErrorMessage("short-msg");
        when(gameExceptionRepository.save(any(GameException.class))).thenReturn(saved);

        GameException out = service.ingest(
                GAME_ID, TOKEN, PID, new GameExceptionIngestRequest("full", "loc", "map", "trace", "short-msg"));

        assertThat(out.getShortErrorMessage()).isEqualTo("short-msg");
        ArgumentCaptor<GameException> cap = ArgumentCaptor.forClass(GameException.class);
        verify(gameExceptionRepository).save(cap.capture());
        assertThat(cap.getValue().getShortErrorMessage()).isEqualTo("short-msg");
        assertThat(cap.getValue().getErrorMessage()).isEqualTo("full");
    }
}
