package httpserver

import (
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/auth"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/httpx"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/repository"
)

func (s *Server) registerGameRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /games/deleted", s.getDeletedGames)
	mux.HandleFunc("GET /games", s.getGames)
	mux.HandleFunc("POST /games", s.postGame)
	mux.HandleFunc("DELETE /games/{gameId}", s.deleteGame)
	mux.HandleFunc("POST /games/{gameId}/restore", s.postGameRestore)
	mux.HandleFunc("GET /games/{gameId}/purge-preview", s.getGamePurgePreview)
	mux.HandleFunc("DELETE /games/{gameId}/permanent", s.deleteGamePermanent)
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

func (s *Server) getDeletedGames(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.games == nil {
		s.noDB(w)
		return
	}
	uid, ok := s.requireUserID(w, r)
	if !ok {
		return
	}
	list, err := s.games.ListDeletedByOwnerWithStats(r.Context(), uid)
	if err != nil {
		log.Printf("list deleted games: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if list == nil {
		list = []repository.DeletedGameSummary{}
	}
	httpx.WriteJSON(w, http.StatusOK, list)
}

func (s *Server) deleteGame(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.games == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	g, ok := s.requireOwnedGame(w, r, gameID)
	if !ok {
		return
	}
	ctx := r.Context()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		log.Printf("soft delete begin tx: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer func() { _ = tx.Rollback() }()
	if err := s.games.SoftDeleteGameTx(ctx, tx, g.ID, time.Now().UTC()); err != nil {
		if errors.Is(err, repository.ErrGameNotActive) {
			http.Error(w, "game not found", http.StatusNotFound)
			return
		}
		log.Printf("soft delete game: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := tx.Commit(); err != nil {
		log.Printf("soft delete commit: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) postGameRestore(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.games == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	g, ok := s.requireOwnedDeletedGame(w, r, gameID)
	if !ok {
		return
	}
	ctx := r.Context()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		log.Printf("restore game begin tx: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer func() { _ = tx.Rollback() }()
	if err := s.games.RestoreGameTx(ctx, tx, g.ID); err != nil {
		if errors.Is(err, repository.ErrGameNotDeleted) {
			http.Error(w, "game not found", http.StatusNotFound)
			return
		}
		log.Printf("restore game: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := tx.Commit(); err != nil {
		log.Printf("restore game commit: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"id": g.ID, "name": g.Name})
}

func (s *Server) getGamePurgePreview(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.games == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	uid, ok := s.requireUserID(w, r)
	if !ok {
		return
	}
	preview, err := s.games.PurgePreview(r.Context(), gameID, uid)
	if err != nil {
		log.Printf("purge preview: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if preview == nil {
		http.Error(w, "game not found", http.StatusNotFound)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, preview)
}

func (s *Server) deleteGamePermanent(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.games == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	g, ok := s.requireOwnedDeletedGame(w, r, gameID)
	if !ok {
		return
	}
	ctx := r.Context()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		log.Printf("hard delete begin tx: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer func() { _ = tx.Rollback() }()
	if err := s.games.HardDeleteGameTx(ctx, tx, g.ID); err != nil {
		if errors.Is(err, repository.ErrGameNotDeleted) {
			http.Error(w, "game not found", http.StatusNotFound)
			return
		}
		log.Printf("hard delete game: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := tx.Commit(); err != nil {
		log.Printf("hard delete commit: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
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
