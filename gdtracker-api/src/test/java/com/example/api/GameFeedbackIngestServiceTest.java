package com.example.api;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.api.dto.GameFeedbackIngestRequest;
import com.example.api.model.Game;
import com.example.api.model.GameFeedbackMeterDefinition;
import com.example.api.model.GamePlayer;
import com.example.api.repository.GameFeedbackMeterDefinitionRepository;
import com.example.api.repository.GameFeedbackRepository;
import com.example.api.service.GameFeedbackIngestService;
import com.example.api.service.GameIngestTokenService;
import com.example.api.service.GamePlayerService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class GameFeedbackIngestServiceTest {

    private static final String GAME_ID = "g1";
    private static final String TOKEN = "tok";
    private static final String PID = "p1";

    @Mock
    private GameIngestTokenService gameIngestTokenService;

    @Mock
    private GamePlayerService gamePlayerService;

    @Mock
    private GameFeedbackMeterDefinitionRepository meterDefinitionRepository;

    @Mock
    private GameFeedbackRepository gameFeedbackRepository;

    @InjectMocks
    private GameFeedbackIngestService service;

    private Game game;
    private GamePlayer player;

    @BeforeEach
    void setUp() {
        game = new Game();
        game.setId(GAME_ID);
        player = new GamePlayer(game);
        player.setId(PID);
        when(gameIngestTokenService.requireGameForIngestToken(eq(GAME_ID), eq(TOKEN)))
                .thenReturn(game);
        when(gamePlayerService.requirePlayerForIngest(eq(GAME_ID), eq(PID))).thenReturn(player);
    }

    @Test
    void ingest_unknownMeterKey_shouldThrowBadRequest() {
        GameFeedbackMeterDefinition def = new GameFeedbackMeterDefinition("fun", "How fun?", 0, game);
        def.setId("m1");
        when(meterDefinitionRepository.findByGame_IdOrderBySortOrderAscFieldKeyAsc(GAME_ID))
                .thenReturn(List.of(def));

        GameFeedbackIngestRequest req = new GameFeedbackIngestRequest("t", "d", Map.of("fun", 5, "extra", 3));

        assertThatThrownBy(() -> service.ingest(GAME_ID, TOKEN, PID, req))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void ingest_outOfRange_shouldThrowBadRequest() {
        GameFeedbackMeterDefinition def = new GameFeedbackMeterDefinition("fun", "How fun?", 0, game);
        when(meterDefinitionRepository.findByGame_IdOrderBySortOrderAscFieldKeyAsc(GAME_ID))
                .thenReturn(List.of(def));

        GameFeedbackIngestRequest req = new GameFeedbackIngestRequest("t", "d", Map.of("fun", 11));

        assertThatThrownBy(() -> service.ingest(GAME_ID, TOKEN, PID, req))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void ingest_metersWhenNoTemplate_shouldThrowBadRequest() {
        when(meterDefinitionRepository.findByGame_IdOrderBySortOrderAscFieldKeyAsc(GAME_ID))
                .thenReturn(List.of());

        GameFeedbackIngestRequest req = new GameFeedbackIngestRequest("t", "d", Map.of("x", 1));

        assertThatThrownBy(() -> service.ingest(GAME_ID, TOKEN, PID, req))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void ingest_valid_shouldSave() {
        when(meterDefinitionRepository.findByGame_IdOrderBySortOrderAscFieldKeyAsc(GAME_ID))
                .thenReturn(List.of());

        GameFeedbackIngestRequest req = new GameFeedbackIngestRequest("t", "d", Map.of());

        service.ingest(GAME_ID, TOKEN, PID, req);

        verify(gameFeedbackRepository).save(any());
    }
}
