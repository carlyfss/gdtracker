package httpserver

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/httpx"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/util"
	"github.com/lib/pq"
)

func (s *Server) registerTagRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /games/{gameId}/tags", s.getTags)
	mux.HandleFunc("POST /games/{gameId}/tags", s.postTag)
	mux.HandleFunc("PUT /games/{gameId}/tags/{id}", s.putTag)
	mux.HandleFunc("DELETE /games/{gameId}/tags/{id}", s.deleteTag)
}

type tagUpsertBody struct {
	Name        string  `json:"name"`
	Color       *string `json:"color"`
	Description *string `json:"description"`
}

func (s *Server) getTags(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	list, err := s.tags.ListByGameOrderByNameAsc(r.Context(), gameID)
	if err != nil {
		log.Printf("list tags: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := make([]map[string]any, 0, len(list))
	for _, t := range list {
		out = append(out, tagToMap(t))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (s *Server) postTag(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	var body tagUpsertBody
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
	exists, err := s.tags.ExistsByGameAndNameIgnoreCase(ctx, gameID, name)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if exists {
		http.Error(w, "tag already exists", http.StatusConflict)
		return
	}
	color, err := util.ResolveColorForCreate(derefString(body.Color), util.DefaultCategoryColor)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	t, err := s.tags.Insert(ctx, gameID, name, color, body.Description)
	if err != nil {
		if isPGUniqueViolation(err) {
			http.Error(w, "tag already exists", http.StatusConflict)
			return
		}
		log.Printf("insert tag: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, tagToMap(*t))
}

func (s *Server) putTag(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	id := r.PathValue("id")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	var body tagUpsertBody
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
	existing, err := s.tags.FindByIDAndGame(ctx, id, gameID)
	if err != nil || existing == nil {
		http.Error(w, "tag not found", http.StatusNotFound)
		return
	}
	other, err := s.tags.FindByGameAndNameIgnoreCase(ctx, gameID, name)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if other != nil && other.ID != existing.ID {
		http.Error(w, "tag already exists", http.StatusConflict)
		return
	}
	existing.Name = name
	if body.Color != nil && strings.TrimSpace(*body.Color) != "" {
		col, err := util.ValidateColorHex(strings.TrimSpace(*body.Color))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		existing.Color = col
	}
	if body.Description != nil {
		t := strings.TrimSpace(*body.Description)
		if t == "" {
			existing.Description = sql.NullString{}
		} else {
			existing.Description = sql.NullString{String: t, Valid: true}
		}
	}
	if err := s.tags.Update(ctx, existing); err != nil {
		log.Printf("update tag: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, tagToMap(*existing))
}

func (s *Server) deleteTag(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	id := r.PathValue("id")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	ctx := r.Context()
	t, err := s.tags.FindByIDAndGame(ctx, id, gameID)
	if err != nil || t == nil {
		http.Error(w, "tag not found", http.StatusNotFound)
		return
	}
	if err := s.tags.DeleteByID(ctx, id); err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23503" {
			http.Error(w, "tag in use", http.StatusConflict)
			return
		}
		log.Printf("delete tag: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
