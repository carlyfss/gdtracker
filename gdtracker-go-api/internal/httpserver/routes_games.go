package httpserver

import (
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/auth"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/httpx"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/repository"
)

func (s *Server) registerGameRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /games", s.getGames)
	mux.HandleFunc("POST /games", s.postGame)
	mux.HandleFunc("GET /games/{gameId}/ingest-token", s.getIngestTokenStatus)
	mux.HandleFunc("POST /games/{gameId}/ingest-token/regenerate", s.postIngestTokenRegenerate)
}

type createGameBody struct {
	Name string `json:"name"`
}

func (s *Server) getGames(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.games == nil {
		s.noDB(w)
		return
	}
	uid, ok := s.requireUserID(w, r)
	if !ok {
		return
	}
	list, err := s.games.ListByOwnerOrderByNameAsc(r.Context(), uid)
	if err != nil {
		log.Printf("list games: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := make([]map[string]string, 0, len(list))
	for _, g := range list {
		out = append(out, map[string]string{"id": g.ID, "name": g.Name})
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (s *Server) postGame(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.games == nil {
		s.noDB(w)
		return
	}
	uid, ok := s.requireUserID(w, r)
	if !ok {
		return
	}
	var body createGameBody
	if err := httpx.ReadJSON(r, &body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	id, err := s.games.Insert(ctx, name, uid)
	if err != nil {
		log.Printf("create game: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := repository.EnsureGameBootstrap(ctx, s.db, id); err != nil {
		log.Printf("game bootstrap: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, map[string]string{"id": id, "name": name})
}

func (s *Server) getIngestTokenStatus(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.games == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	g, ok := s.requireOwnedGame(w, r, gameID)
	if !ok {
		return
	}
	configured := g.IngestTokenHash.Valid && strings.TrimSpace(g.IngestTokenHash.String) != ""
	var createdAt any
	if g.IngestTokenCreatedAt.Valid {
		createdAt = g.IngestTokenCreatedAt.Time.UTC().Format(time.RFC3339Nano)
	} else {
		createdAt = nil
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"configured": configured,
		"createdAt":  createdAt,
	})
}

func (s *Server) postIngestTokenRegenerate(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.games == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	g, ok := s.requireOwnedGame(w, r, gameID)
	if !ok {
		return
	}
	plain, err := auth.NewRandomIngestPlaintext()
	if err != nil {
		log.Printf("ingest token random: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	hash, err := auth.HashIngestToken(plain)
	if err != nil {
		log.Printf("ingest token hash: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	now := time.Now().UTC()
	if err := s.games.SetIngestToken(r.Context(), g.ID, hash, now); err != nil {
		log.Printf("ingest token save: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"token":     plain,
		"createdAt": now.Format(time.RFC3339Nano),
	})
}
