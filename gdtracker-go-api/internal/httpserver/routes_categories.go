package httpserver

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/httpx"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/util"
	"github.com/lib/pq"
)

func (s *Server) registerCategoryRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /games/{gameId}/categories", s.getCategories)
	mux.HandleFunc("POST /games/{gameId}/categories", s.postCategory)
	mux.HandleFunc("PUT /games/{gameId}/categories/{id}", s.putCategory)
	mux.HandleFunc("DELETE /games/{gameId}/categories/{id}", s.deleteCategory)
}

type categoryUpsertBody struct {
	Name  string  `json:"name"`
	Color *string `json:"color"`
}

func (s *Server) getCategories(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	list, err := s.categories.ListByGameOrderByNameAsc(r.Context(), gameID)
	if err != nil {
		log.Printf("list categories: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := make([]map[string]any, 0, len(list))
	for _, c := range list {
		out = append(out, categoryToMap(c))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (s *Server) postCategory(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	var body categoryUpsertBody
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
	exists, err := s.categories.ExistsByGameAndNameIgnoreCase(ctx, gameID, name)
	if err != nil {
		log.Printf("category exists: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if exists {
		http.Error(w, "category already exists", http.StatusConflict)
		return
	}
	color, err := util.ResolveColorForCreate(derefString(body.Color), util.DefaultCategoryColor)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	c, err := s.categories.Insert(ctx, gameID, name, color)
	if err != nil {
		if isPGUniqueViolation(err) {
			http.Error(w, "category already exists", http.StatusConflict)
			return
		}
		log.Printf("insert category: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, categoryToMap(*c))
}

func (s *Server) putCategory(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	id := r.PathValue("id")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	var body categoryUpsertBody
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
	existing, err := s.categories.FindByIDAndGame(ctx, id, gameID)
	if err != nil || existing == nil {
		http.Error(w, "category not found", http.StatusNotFound)
		return
	}
	other, err := s.categories.FindByGameAndNameIgnoreCase(ctx, gameID, name)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if other != nil && other.ID != existing.ID {
		http.Error(w, "category already exists", http.StatusConflict)
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
	if err := s.categories.Update(ctx, existing); err != nil {
		log.Printf("update category: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, categoryToMap(*existing))
}

func (s *Server) deleteCategory(w http.ResponseWriter, r *http.Request) {
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
	c, err := s.categories.FindByIDAndGame(ctx, id, gameID)
	if err != nil {
		log.Printf("find category: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if c == nil {
		http.Error(w, "category not found", http.StatusNotFound)
		return
	}
	hasTasks, err := s.taskRefs.ExistsByCategoryID(ctx, id)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if hasTasks {
		http.Error(w, "category has tasks", http.StatusConflict)
		return
	}
	if err := s.categories.DeleteByID(ctx, id); err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23503" {
			http.Error(w, "category in use", http.StatusConflict)
			return
		}
		log.Printf("delete category: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func derefString(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
