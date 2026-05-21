package httpserver

import (
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/auth"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/httpx"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/repository"
	"github.com/google/uuid"
)

func (s *Server) registerIngestPlaneRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /games/{gameId}/game-players", s.postGamePlayers)
	mux.HandleFunc("POST /games/{gameId}/integration", s.postIntegrationPing)
	mux.HandleFunc("GET /games/{gameId}/integration/status", s.getIntegrationStatus)
}

// verifyIngestForGame loads an active game by id and verifies Bearer token against stored hash.
// Soft-deleted games are excluded (FindByID filters deleted_at IS NULL) and yield 404.
func (s *Server) verifyIngestForGame(w http.ResponseWriter, r *http.Request, gameID string) (*repository.GameRow, bool) {
	if s.db == nil || s.games == nil {
		s.noDB(w)
		return nil, false
	}
	authz, err := httpx.ExtractBearerToken(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return nil, false
	}
	g, err := s.games.FindByID(r.Context(), gameID)
	if err != nil {
		log.Printf("ingest find game: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return nil, false
	}
	if g == nil {
		http.Error(w, "game not found", http.StatusNotFound)
		return nil, false
	}
	hash := ""
	if g.IngestTokenHash.Valid {
		hash = g.IngestTokenHash.String
	}
	if err := auth.VerifyIngestToken(authz, hash); err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return nil, false
	}
	return g, true
}

func (s *Server) postGamePlayers(w http.ResponseWriter, r *http.Request) {
	if s.gamePlayers == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.verifyIngestForGame(w, r, gameID); !ok {
		return
	}
	id := uuid.NewString()
	now := time.Now().UTC()
	if err := s.gamePlayers.Insert(r.Context(), id, gameID, now); err != nil {
		log.Printf("register player: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, map[string]string{"playerId": id})
}

type integrationPingBody struct {
	Validation string `json:"validation"`
}

func (s *Server) postIntegrationPing(w http.ResponseWriter, r *http.Request) {
	if s.games == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	g, ok := s.verifyIngestForGame(w, r, gameID)
	if !ok {
		return
	}
	var body integrationPingBody
	if err := httpx.ReadJSON(r, &body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	v := strings.TrimSpace(body.Validation)
	if v == "" {
		http.Error(w, "validation is required", http.StatusBadRequest)
		return
	}
	if v != "ok" {
		http.Error(w, "validation must be \"ok\"", http.StatusBadRequest)
		return
	}
	_ = g // token already verified
	if err := s.games.SetLastIntegrationValidationAt(r.Context(), gameID, time.Now().UTC()); err != nil {
		log.Printf("integration ping: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) getIntegrationStatus(w http.ResponseWriter, r *http.Request) {
	if s.games == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	g, ok := s.requireOwnedGame(w, r, gameID)
	if !ok {
		return
	}
	var resp map[string]any
	if g.LastIntegrationValAt.Valid {
		resp = map[string]any{"lastValidatedAt": g.LastIntegrationValAt.Time.UTC().Format(time.RFC3339Nano)}
	} else {
		resp = map[string]any{"lastValidatedAt": nil}
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}
