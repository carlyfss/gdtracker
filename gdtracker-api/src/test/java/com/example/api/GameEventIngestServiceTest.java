package com.example.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.api.dto.GameEventIngestRequest;
import com.example.api.model.Game;
import com.example.api.model.GameEvent;
import com.example.api.model.GameEventDefinition;
import com.example.api.model.GameEventTrace;
import com.example.api.repository.GameEventDefinitionRepository;
import com.example.api.repository.GameEventRepository;
import com.example.api.repository.GameEventTraceRepository;
import com.example.api.service.GameEventIngestService;
import com.example.api.service.GameEventTemplateService;
import com.example.api.service.GameIngestTokenService;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class GameEventIngestServiceTest {

    private static final String GAME_ID = "game-1";
    private static final String INGEST_TOKEN = "token";
    private static final String CODE = "player_died";

    @Mock
    private GameIngestTokenService gameIngestTokenService;

    @Mock
    private GameEventDefinitionRepository definitionRepository;

    @Mock
    private GameEventRepository gameEventRepository;

    @Mock
    private GameEventTraceRepository gameEventTraceRepository;

    @Mock
    private GameEventTemplateService templateService;

    @InjectMocks
    private GameEventIngestService service;

    private Game game;
    private GameEventDefinition definition;

    @BeforeEach
    void setUp() {
        game = new Game();
        game.setId(GAME_ID);

        definition = new GameEventDefinition();
        definition.setId("def-1");
        definition.setCode(CODE);
        definition.setMessageTemplate("Player <PLAYER_ID> died to <ENEMY> at <MAP>:<LOCATION>");
        definition.setColor("#ff0000");
        definition.setGame(game);

        when(gameIngestTokenService.requireGameForIngestToken(eq(GAME_ID), eq(INGEST_TOKEN)))
                .thenReturn(game);
        when(definitionRepository.findByGame_IdAndCodeIgnoreCase(eq(GAME_ID), eq(CODE)))
                .thenReturn(Optional.of(definition));
        when(gameEventRepository.save(any(GameEvent.class))).thenAnswer(inv -> {
            GameEvent e = inv.getArgument(0);
            e.setId("event-1");
            return e;
        });
    }

    @Test
    void ingest_withLocationAndMap_shouldAlsoCreateTraceLinkedToEvent() {
        Map<String, String> normalized = new HashMap<>();
        normalized.put("PLAYER_ID", "123");
        normalized.put("ENEMY", "Zombie");
        normalized.put("MAP", "proto-dungeon");
        normalized.put("LOCATION", "(35, 22, 17)");
        Map<String, String> rawParams = new HashMap<>();
        rawParams.put("player_id", "123");
        rawParams.put("enemy", "Zombie");
        rawParams.put("map", "proto-dungeon");
        rawParams.put("location", "(35, 22, 17)");

        when(templateService.normalizeKeys(any())).thenReturn(normalized);
        when(templateService.render(eq(definition.getMessageTemplate()), eq(normalized)))
                .thenReturn("Player 123 died to Zombie at proto-dungeon:(35, 22, 17)");

        GameEventIngestRequest request = new GameEventIngestRequest(CODE, rawParams);

        GameEvent saved = service.ingest(GAME_ID, INGEST_TOKEN, request);

        assertThat(saved.getId()).isEqualTo("event-1");

        ArgumentCaptor<GameEventTrace> captor = ArgumentCaptor.forClass(GameEventTrace.class);
        verify(gameEventTraceRepository).save(captor.capture());
        GameEventTrace trace = captor.getValue();
        assertThat(trace.getLocation()).isEqualTo("(35, 22, 17)");
        assertThat(trace.getMap()).isEqualTo("proto-dungeon");
        assertThat(trace.getGame()).isSameAs(game);
        assertThat(trace.getGameEvent()).isSameAs(saved);
    }

    @Test
    void ingest_withoutLocationOrMap_shouldNotCreateTrace() {
        Map<String, String> normalized = new HashMap<>();
        normalized.put("PLAYER_ID", "123");
        when(templateService.normalizeKeys(any())).thenReturn(normalized);
        when(templateService.render(any(), any())).thenReturn("Player 123 leveled up");

        Map<String, String> rawParams = new HashMap<>();
        rawParams.put("player_id", "123");
        GameEventIngestRequest request = new GameEventIngestRequest(CODE, rawParams);

        service.ingest(GAME_ID, INGEST_TOKEN, request);

        verify(gameEventTraceRepository, never()).save(any(GameEventTrace.class));
    }

    @Test
    void ingest_withBlankLocation_shouldNotCreateTrace() {
        Map<String, String> normalized = new HashMap<>();
        normalized.put("LOCATION", "  ");
        normalized.put("MAP", "proto-dungeon");
        when(templateService.normalizeKeys(any())).thenReturn(normalized);
        when(templateService.render(any(), any())).thenReturn("rendered");

        Map<String, String> rawParams = new HashMap<>();
        rawParams.put("location", "  ");
        rawParams.put("map", "proto-dungeon");
        GameEventIngestRequest request = new GameEventIngestRequest(CODE, rawParams);

        service.ingest(GAME_ID, INGEST_TOKEN, request);

        verify(gameEventTraceRepository, never()).save(any(GameEventTrace.class));
    }
}
