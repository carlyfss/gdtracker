package httpserver

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/httpx"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/repository"
)

const (
	maxPlanningNameRunes  = 512
	maxPlanningMarkdown   = 512 * 1024
	maxPlanningExcalidraw = 4 << 20 // 4 MiB JSON
)

func (s *Server) registerPlanningRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /games/{gameId}/planning-nodes", s.getPlanningNodes)
	mux.HandleFunc("GET /games/{gameId}/planning-nodes/{id}", s.getPlanningNode)
	mux.HandleFunc("POST /games/{gameId}/planning-nodes", s.postPlanningNode)
	mux.HandleFunc("PUT /games/{gameId}/planning-nodes/{id}", s.putPlanningNode)
	mux.HandleFunc("DELETE /games/{gameId}/planning-nodes/{id}", s.deletePlanningNode)
}

func planningKindValid(k string) bool {
	switch k {
	case repository.PlanningKindFolder, repository.PlanningKindMarkdown, repository.PlanningKindExcalidraw:
		return true
	default:
		return false
	}
}

func normalizePlanningName(raw string) (string, error) {
	name := strings.TrimSpace(raw)
	if name == "" {
		return "", errors.New("name is required")
	}
	if utf8.RuneCountInString(name) > maxPlanningNameRunes {
		return "", errors.New("name too long")
	}
	return name, nil
}

func planningMetaJSON(m repository.PlanningNodeMeta) map[string]any {
	out := map[string]any{
		"id":        m.ID,
		"kind":      m.Kind,
		"name":      m.Name,
		"sortOrder": m.SortOrder,
		"updatedAt": m.UpdatedAt.UTC().Format(time.RFC3339Nano),
		"createdAt": m.CreatedAt.UTC().Format(time.RFC3339Nano),
	}
	if m.ParentID.Valid {
		out["parentId"] = m.ParentID.String
	} else {
		out["parentId"] = nil
	}
	return out
}

func planningDetailJSON(d *repository.PlanningNodeDetail) map[string]any {
	out := planningMetaJSON(d.PlanningNodeMeta)
	if d.MarkdownBody.Valid {
		out["markdownBody"] = d.MarkdownBody.String
	} else {
		out["markdownBody"] = nil
	}
	if d.ExcalidrawScene.Valid {
		var raw json.RawMessage
		if err := json.Unmarshal([]byte(d.ExcalidrawScene.String), &raw); err != nil {
			out["excalidrawScene"] = nil
		} else {
			out["excalidrawScene"] = raw
		}
	} else {
		out["excalidrawScene"] = nil
	}
	return out
}

func (s *Server) getPlanningNodes(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.planning == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	list, err := s.planning.ListMetaByGame(r.Context(), gameID)
	if err != nil {
		log.Printf("list planning nodes: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := make([]map[string]any, 0, len(list))
	for _, m := range list {
		out = append(out, planningMetaJSON(m))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (s *Server) getPlanningNode(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.planning == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	id := r.PathValue("id")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	d, err := s.planning.FindByIDAndGame(r.Context(), id, gameID)
	if err != nil {
		log.Printf("get planning node: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if d == nil {
		http.Error(w, "planning node not found", http.StatusNotFound)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, planningDetailJSON(d))
}

type planningCreateBody struct {
	ParentID        *string         `json:"parentId"`
	Kind            string          `json:"kind"`
	Name            string          `json:"name"`
	MarkdownBody    *string         `json:"markdownBody"`
	ExcalidrawScene json.RawMessage `json:"excalidrawScene"`
}

func (s *Server) postPlanningNode(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.planning == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	var body planningCreateBody
	if err := httpx.ReadJSONMaxBytes(r, httpx.LargePlanningJSONBodyBytes, &body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if !planningKindValid(body.Kind) {
		http.Error(w, "invalid kind", http.StatusBadRequest)
		return
	}
	name, err := normalizePlanningName(body.Name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	var parentID sql.NullString
	if body.ParentID != nil && strings.TrimSpace(*body.ParentID) != "" {
		pid := strings.TrimSpace(*body.ParentID)
		pkind, ok, err := s.planning.FindKindByIDAndGame(ctx, pid, gameID)
		if err != nil {
			log.Printf("planning parent kind: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if !ok {
			http.Error(w, "parent not found", http.StatusBadRequest)
			return
		}
		if pkind != repository.PlanningKindFolder {
			http.Error(w, "parent must be a folder", http.StatusBadRequest)
			return
		}
		parentID = sql.NullString{String: pid, Valid: true}
	}

	if err := validatePlanningPayloadForCreate(body.Kind, body.MarkdownBody, body.ExcalidrawScene); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	sortOrder, err := s.planning.NextSortOrder(ctx, gameID, parentID)
	if err != nil {
		log.Printf("planning sort: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	ins := repository.PlanningInsert{
		GameID:    gameID,
		ParentID:  parentID,
		Kind:      body.Kind,
		Name:      name,
		SortOrder: sortOrder,
	}
	switch body.Kind {
	case repository.PlanningKindFolder:
		ins.MarkdownBody = sql.NullString{}
		ins.ExcalidrawScene = nil
	case repository.PlanningKindMarkdown:
		md := ""
		if body.MarkdownBody != nil {
			md = *body.MarkdownBody
		}
		ins.MarkdownBody = sql.NullString{String: md, Valid: true}
	case repository.PlanningKindExcalidraw:
		if len(body.ExcalidrawScene) > 0 {
			ins.ExcalidrawScene = append([]byte(nil), body.ExcalidrawScene...)
		}
	}

	d, err := s.planning.Insert(ctx, ins)
	if err != nil {
		if repository.PlanningUniqueViolation(err) {
			http.Error(w, "name already exists in this folder", http.StatusConflict)
			return
		}
		log.Printf("insert planning: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, planningDetailJSON(d))
}

func validatePlanningPayloadForCreate(kind string, md *string, exc json.RawMessage) error {
	switch kind {
	case repository.PlanningKindFolder:
		if md != nil && strings.TrimSpace(*md) != "" {
			return errors.New("folder cannot have markdownBody")
		}
		if len(exc) > 0 {
			return errors.New("folder cannot have excalidrawScene")
		}
	case repository.PlanningKindMarkdown:
		if len(exc) > 0 {
			return errors.New("markdown cannot have excalidrawScene")
		}
		if md != nil && len(*md) > maxPlanningMarkdown {
			return errors.New("markdownBody too large")
		}
	case repository.PlanningKindExcalidraw:
		if md != nil && strings.TrimSpace(*md) != "" {
			return errors.New("excalidraw cannot have markdownBody")
		}
		if len(exc) > maxPlanningExcalidraw {
			return errors.New("excalidrawScene too large")
		}
		if len(exc) > 0 && !json.Valid(exc) {
			return errors.New("excalidrawScene must be valid JSON")
		}
	}
	return nil
}

type planningUpdateBody struct {
	Name            *string          `json:"name"`
	ParentID        json.RawMessage  `json:"parentId"`
	SortOrder       *int             `json:"sortOrder"`
	MarkdownBody    *string          `json:"markdownBody"`
	ExcalidrawScene *json.RawMessage `json:"excalidrawScene"`
}

func (s *Server) putPlanningNode(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.planning == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	id := r.PathValue("id")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	var body planningUpdateBody
	if err := httpx.ReadJSONMaxBytes(r, httpx.LargePlanningJSONBodyBytes, &body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	existing, err := s.planning.FindByIDAndGame(ctx, id, gameID)
	if err != nil {
		log.Printf("planning find: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "planning node not found", http.StatusNotFound)
		return
	}

	var patch repository.PlanningUpdate

	if body.Name != nil {
		n, err := normalizePlanningName(*body.Name)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		patch.Name = &n
	}

	if len(body.ParentID) > 0 {
		ns, err := parseParentIDForPatch(body.ParentID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := validateMove(ctx, s.planning, gameID, id, ns); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		patch.ParentID = &ns
	}

	if body.SortOrder != nil {
		patch.SortOrder = body.SortOrder
	}

	if body.MarkdownBody != nil {
		if existing.Kind != repository.PlanningKindMarkdown {
			http.Error(w, "markdownBody only for markdown nodes", http.StatusBadRequest)
			return
		}
		if len(*body.MarkdownBody) > maxPlanningMarkdown {
			http.Error(w, "markdownBody too large", http.StatusBadRequest)
			return
		}
		md := *body.MarkdownBody
		patch.MarkdownBody = &md
	}

	if body.ExcalidrawScene != nil {
		if existing.Kind != repository.PlanningKindExcalidraw {
			http.Error(w, "excalidrawScene only for excalidraw nodes", http.StatusBadRequest)
			return
		}
		raw := *body.ExcalidrawScene
		if len(raw) > maxPlanningExcalidraw {
			http.Error(w, "excalidrawScene too large", http.StatusBadRequest)
			return
		}
		if len(raw) > 0 && !json.Valid(raw) {
			http.Error(w, "excalidrawScene must be valid JSON", http.StatusBadRequest)
			return
		}
		exc := append([]byte(nil), raw...)
		patch.ExcalidrawScene = &exc
	}

	if patch.Name == nil && patch.ParentID == nil && patch.SortOrder == nil && patch.MarkdownBody == nil && patch.ExcalidrawScene == nil {
		httpx.WriteJSON(w, http.StatusOK, planningDetailJSON(existing))
		return
	}

	if err := s.planning.Update(ctx, gameID, id, patch); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "planning node not found", http.StatusNotFound)
			return
		}
		if repository.PlanningUniqueViolation(err) {
			http.Error(w, "name already exists in this folder", http.StatusConflict)
			return
		}
		log.Printf("update planning: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	d, err := s.planning.FindByIDAndGame(ctx, id, gameID)
	if err != nil || d == nil {
		log.Printf("planning reload: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, planningDetailJSON(d))
}

func parseParentIDForPatch(raw json.RawMessage) (sql.NullString, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return sql.NullString{Valid: false}, nil
	}
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return sql.NullString{}, errors.New("parentId must be a string or null")
	}
	s = strings.TrimSpace(s)
	if s == "" {
		return sql.NullString{Valid: false}, nil
	}
	return sql.NullString{String: s, Valid: true}, nil
}

func validateMove(ctx context.Context, pr *repository.PlanningRepository, gameID, nodeID string, newParent sql.NullString) error {
	if !newParent.Valid {
		return nil
	}
	pkind, ok, err := pr.FindKindByIDAndGame(ctx, newParent.String, gameID)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("parent not found")
	}
	if pkind != repository.PlanningKindFolder {
		return errors.New("parent must be a folder")
	}
	if newParent.String == nodeID {
		return errors.New("invalid parent")
	}
	isAnc, err := pr.IsAncestorOf(ctx, gameID, nodeID, newParent.String)
	if err != nil {
		return err
	}
	if isAnc {
		return errors.New("cannot move under a descendant")
	}
	return nil
}

func (s *Server) deletePlanningNode(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.planning == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	id := r.PathValue("id")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	err := s.planning.Delete(r.Context(), gameID, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "planning node not found", http.StatusNotFound)
			return
		}
		log.Printf("delete planning: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
