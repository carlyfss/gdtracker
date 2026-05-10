package httpserver

import (
	"database/sql"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/httpx"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/repository"
	"github.com/google/uuid"
)

func (s *Server) registerTraceRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /games/{gameId}/game-trace", s.getGameTrace)
	mux.HandleFunc("POST /games/{gameId}/game-trace/ingest", s.postGameTraceIngest)
}

func traceRowToMap(t repository.GameEventTraceRow) map[string]any {
	m := map[string]any{
		"id":        t.ID,
		"timestamp": t.Timestamp.UTC().Format(time.RFC3339Nano),
	}
	if t.Location.Valid {
		m["location"] = t.Location.String
	} else {
		m["location"] = nil
	}
	if t.Map.Valid {
		m["map"] = t.Map.String
	} else {
		m["map"] = nil
	}
	if t.GamePlayerID.Valid {
		m["playerId"] = t.GamePlayerID.String
	} else {
		m["playerId"] = nil
	}
	if t.GameEventID.Valid {
		m["gameEventId"] = t.GameEventID.String
	} else {
		m["gameEventId"] = nil
	}
	if t.RenderedMessage.Valid {
		m["renderedMessage"] = t.RenderedMessage.String
	} else {
		m["renderedMessage"] = nil
	}
	if t.DefinitionCode.Valid {
		m["definitionCode"] = t.DefinitionCode.String
	} else {
		m["definitionCode"] = nil
	}
	if t.DefinitionColor.Valid {
		m["definitionColor"] = t.DefinitionColor.String
	} else {
		m["definitionColor"] = nil
	}
	return m
}

func (s *Server) getGameTrace(w http.ResponseWriter, r *http.Request) {
	if s.gameTraces == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	pid := strings.TrimSpace(r.URL.Query().Get("playerId"))
	ctx := r.Context()
	var list []repository.GameEventTraceRow
	var err error
	if pid == "" {
		list, err = s.gameTraces.ListByGameOrderByTimestampDesc(ctx, gameID)
	} else {
		list, err = s.gameTraces.ListByGameAndPlayerOrderByTimestampDesc(ctx, gameID, pid)
	}
	if err != nil {
		log.Printf("list trace: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := make([]map[string]any, 0, len(list))
	for _, t := range list {
		out = append(out, traceRowToMap(t))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

type gameTraceIngestBody struct {
	Location    string  `json:"location"`
	Map         string  `json:"map"`
	GameEventID *string `json:"gameEventId"`
}

func (s *Server) postGameTraceIngest(w http.ResponseWriter, r *http.Request) {
	if s.gameTraces == nil || s.games == nil || s.gamePlayers == nil || s.gameEvents == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.verifyIngestForGame(w, r, gameID); !ok {
		return
	}
	pid, err := httpx.RequirePlayerID(r.Header)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	ok, err := s.gamePlayers.ExistsByIDAndGame(r.Context(), pid, gameID)
	if err != nil || !ok {
		http.Error(w, "invalid X-Player-Id", http.StatusUnauthorized)
		return
	}
	var body gameTraceIngestBody
	if err := httpx.ReadJSON(r, &body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	loc := body.Location
	mapVal := body.Map
	ctx := r.Context()
	var eventNull sql.NullString
	if body.GameEventID != nil && strings.TrimSpace(*body.GameEventID) != "" {
		eid := strings.TrimSpace(*body.GameEventID)
		row, err := s.gameEvents.FindByID(ctx, eid)
		if err != nil {
			log.Printf("trace ingest find event: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if row == nil {
			http.Error(w, "game event not found", http.StatusNotFound)
			return
		}
		gid, err := s.gameEvents.GameIDForEvent(ctx, eid)
		if err != nil {
			log.Printf("trace ingest game for event: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if gid != gameID {
			http.Error(w, "game event does not belong to this game", http.StatusBadRequest)
			return
		}
		eventNull = sql.NullString{String: eid, Valid: true}
	}
	traceID := uuid.NewString()
	ts := time.Now().UTC()
	playerNull := sql.NullString{String: pid, Valid: true}
	if err := s.gameTraces.Insert(ctx, traceID, gameID, loc, mapVal, playerNull, eventNull, ts); err != nil {
		log.Printf("insert trace: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	row, err := s.gameTraces.FindByID(ctx, traceID)
	if err != nil || row == nil {
		log.Printf("load trace: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, traceRowToMap(*row))
}
