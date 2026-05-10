package httpserver

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"net/http"
	"regexp"
	"strings"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/httpx"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/repository"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/util"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

const defaultFeatureColor = "#818cf8"

var featureNameWs = regexp.MustCompile(`\s+`)

func normalizeFeatureName(raw string) string {
	t := strings.TrimSpace(raw)
	if t == "" {
		return ""
	}
	return featureNameWs.ReplaceAllString(t, " ")
}

func normalizeFeatureDescription(raw *string) sql.NullString {
	if raw == nil {
		return sql.NullString{}
	}
	t := strings.TrimSpace(*raw)
	if t == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: t, Valid: true}
}

func (s *Server) registerFeatureRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /games/{gameId}/features", s.getFeatures)
	mux.HandleFunc("GET /games/{gameId}/features/task-progress", s.getFeaturesTaskProgress)
	mux.HandleFunc("POST /games/{gameId}/features", s.postFeature)
	mux.HandleFunc("PUT /games/{gameId}/features/{id}", s.putFeature)
	mux.HandleFunc("DELETE /games/{gameId}/features/{id}", s.deleteFeature)
	mux.HandleFunc("POST /games/{gameId}/features/{id}/archive", s.postFeatureArchive)
	mux.HandleFunc("POST /games/{gameId}/features/{id}/unarchive", s.postFeatureUnarchive)
}

func (s *Server) getFeatures(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.features == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	archivedOnly := r.URL.Query().Get("archived") == "true"
	list, err := s.features.ListByGameArchivedOrderByNameAsc(r.Context(), gameID, archivedOnly)
	if err != nil {
		log.Printf("list features: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := make([]map[string]any, 0, len(list))
	for _, f := range list {
		out = append(out, featureToMap(f))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (s *Server) getFeaturesTaskProgress(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.features == nil || s.tasks == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	ctx := r.Context()
	archivedOnly := r.URL.Query().Get("archived") == "true"
	features, err := s.features.ListByGameArchivedOrderByNameAsc(ctx, gameID, archivedOnly)
	if err != nil {
		log.Printf("list features progress: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	var counts []repository.FeatureTaskCount
	if archivedOnly {
		counts, err = s.tasks.AggregateArchivedTaskCountsByFeatureForGame(ctx, gameID)
	} else {
		counts, err = s.tasks.AggregateTaskCountsByFeatureForGame(ctx, gameID)
	}
	if err != nil {
		log.Printf("aggregate task counts: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	direct := make(map[string][2]int64)
	for _, c := range counts {
		direct[c.FeatureID] = [2]int64{c.Total, c.Done}
	}
	childrenByParent := make(map[string][]repository.Feature)
	for _, f := range features {
		var pk string
		if f.ParentFeature.Valid {
			pk = f.ParentFeature.String
		}
		childrenByParent[pk] = append(childrenByParent[pk], f)
	}
	memo := make(map[string]featureProgressMemo)
	var aggregate func(string) featureProgressMemo
	aggregate = func(featureID string) featureProgressMemo {
		if m, ok := memo[featureID]; ok {
			return m
		}
		d := direct[featureID]
		totalD, doneD := d[0], d[1]
		rolledT, rolledDone := totalD, doneD
		for _, ch := range childrenByParent[featureID] {
			sub := aggregate(ch.ID)
			rolledT += sub.rolledTotal
			rolledDone += sub.rolledDone
		}
		m := featureProgressMemo{
			totalDirect: totalD,
			doneDirect:  doneD,
			rolledTotal: rolledT,
			rolledDone:  rolledDone,
		}
		memo[featureID] = m
		return m
	}
	out := make([]map[string]any, 0, len(features))
	for _, f := range features {
		m := aggregate(f.ID)
		out = append(out, map[string]any{
			"featureId":     f.ID,
			"totalDirect":   m.totalDirect,
			"doneDirect":    m.doneDirect,
			"rolledUpTotal": m.rolledTotal,
			"rolledUpDone":  m.rolledDone,
		})
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

type featureProgressMemo struct {
	totalDirect int64
	doneDirect  int64
	rolledTotal int64
	rolledDone  int64
}

type featureUpsertBody struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
	Color       *string `json:"color"`
	ParentID    *string `json:"parentId"`
}

func (s *Server) postFeature(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.features == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	var body featureUpsertBody
	if err := httpx.ReadJSON(r, &body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	name := normalizeFeatureName(body.Name)
	if name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	parentID := normalizeOptionalParentID(body.ParentID)
	if parentID != nil {
		p, err := s.features.FindByIDAndGame(ctx, *parentID, gameID)
		if err != nil || p == nil {
			http.Error(w, "parentId is invalid", http.StatusBadRequest)
			return
		}
		if p.ArchivedAt.Valid {
			http.Error(w, "parent feature is archived", http.StatusBadRequest)
			return
		}
	}
	conflict, err := s.features.FindNameInGameParent(ctx, gameID, parentID, name)
	if err != nil {
		log.Printf("feature name check: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if conflict {
		http.Error(w, "feature already exists", http.StatusConflict)
		return
	}
	status := "TODO"
	if body.Status != nil && strings.TrimSpace(*body.Status) != "" {
		st := strings.TrimSpace(*body.Status)
		if !isValidTaskStatus(st) {
			http.Error(w, "status is invalid", http.StatusBadRequest)
			return
		}
		status = st
	}
	color, err := util.ResolveColorForCreate(derefString(body.Color), defaultFeatureColor)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	id := uuid.NewString()
	ins := repository.FeatureInsert{
		ID:          id,
		GameID:      gameID,
		Name:        name,
		Description: normalizeFeatureDescription(body.Description),
		Status:      status,
		Color:       color,
		ParentID:    parentID,
	}
	if err := s.features.Insert(ctx, ins); err != nil {
		if isPGUniqueViolation(err) {
			http.Error(w, "feature already exists", http.StatusConflict)
			return
		}
		log.Printf("insert feature: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	f, err := s.features.FindByIDAndGame(ctx, id, gameID)
	if err != nil || f == nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, featureToMap(*f))
}

func normalizeOptionalParentID(raw *string) *string {
	if raw == nil {
		return nil
	}
	t := strings.TrimSpace(*raw)
	if t == "" {
		return nil
	}
	return &t
}

func (s *Server) putFeature(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.features == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	featureID := r.PathValue("id")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	var body featureUpsertBody
	if err := httpx.ReadJSON(r, &body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	name := normalizeFeatureName(body.Name)
	if name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	existing, err := s.features.FindByIDAndGame(ctx, featureID, gameID)
	if err != nil || existing == nil {
		http.Error(w, "feature not found", http.StatusNotFound)
		return
	}
	if existing.ArchivedAt.Valid {
		http.Error(w, "feature is archived", http.StatusConflict)
		return
	}
	parentID := normalizeOptionalParentID(body.ParentID)
	if parentID != nil {
		if *parentID == featureID {
			http.Error(w, "parent would create a cycle", http.StatusBadRequest)
			return
		}
		p, err := s.features.FindByIDAndGame(ctx, *parentID, gameID)
		if err != nil || p == nil {
			http.Error(w, "parentId is invalid", http.StatusBadRequest)
			return
		}
		if p.ArchivedAt.Valid {
			http.Error(w, "parent feature is archived", http.StatusBadRequest)
			return
		}
		if err := s.assertNoFeatureParentCycle(ctx, gameID, featureID, *parentID); err != nil {
			var he httpStatusErr
			if errors.As(err, &he) {
				http.Error(w, he.msg, he.code)
				return
			}
			log.Printf("feature cycle: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
	}
	other, err := s.features.ExistsOtherNameInParent(ctx, gameID, parentID, name, featureID)
	if err != nil {
		log.Printf("feature name: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if other {
		http.Error(w, "feature already exists", http.StatusConflict)
		return
	}
	status := existing.Status
	if body.Status != nil && strings.TrimSpace(*body.Status) != "" {
		st := strings.TrimSpace(*body.Status)
		if !isValidTaskStatus(st) {
			http.Error(w, "status is invalid", http.StatusBadRequest)
			return
		}
		status = st
	}
	color := existing.Color
	if body.Color != nil && strings.TrimSpace(*body.Color) != "" {
		c, err := util.ValidateColorHex(strings.TrimSpace(*body.Color))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		color = c
	}
	desc := existing.Description
	if body.Description != nil {
		desc = normalizeFeatureDescription(body.Description)
	}
	u := repository.FeatureUpdate{
		ID:          featureID,
		GameID:      gameID,
		Name:        name,
		Description: desc,
		Status:      status,
		Color:       color,
		ParentID:    parentID,
	}
	if err := s.features.Update(ctx, u); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "feature not found", http.StatusNotFound)
			return
		}
		if isPGUniqueViolation(err) {
			http.Error(w, "feature already exists", http.StatusConflict)
			return
		}
		log.Printf("update feature: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	f, err := s.features.FindByIDAndGame(ctx, featureID, gameID)
	if err != nil || f == nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, featureToMap(*f))
}

func (s *Server) assertNoFeatureParentCycle(ctx context.Context, gameID, featureID, newParentID string) error {
	walk := newParentID
	for hops := 0; hops < 1000; hops++ {
		if walk == featureID {
			return httpStatusErr{400, "parent would create a cycle"}
		}
		p, err := s.features.FindByIDAndGame(ctx, walk, gameID)
		if err != nil {
			return err
		}
		if p == nil {
			return nil
		}
		if !p.ParentFeature.Valid {
			return nil
		}
		walk = p.ParentFeature.String
	}
	return httpStatusErr{400, "parent would create a cycle"}
}

func (s *Server) deleteFeature(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.features == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	featureID := r.PathValue("id")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	ctx := r.Context()
	ex, err := s.features.FindByIDAndGame(ctx, featureID, gameID)
	if err != nil {
		log.Printf("find feature: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if ex == nil {
		http.Error(w, "feature not found", http.StatusNotFound)
		return
	}
	hasChild, err := s.features.ExistsChildWithParentID(ctx, featureID)
	if err != nil {
		log.Printf("feature children: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if hasChild {
		http.Error(w, "feature has subfeatures", http.StatusConflict)
		return
	}
	hasTasks, err := s.features.ExistsTaskForFeatureID(ctx, featureID)
	if err != nil {
		log.Printf("feature tasks: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if hasTasks {
		http.Error(w, "feature has tasks", http.StatusConflict)
		return
	}
	if err := s.features.DeleteByIDAndGame(ctx, featureID, gameID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "feature not found", http.StatusNotFound)
			return
		}
		if isPGUniqueViolation(err) || isPGForeignKeyViolation(err) {
			http.Error(w, "feature has subfeatures or tasks", http.StatusConflict)
			return
		}
		log.Printf("delete feature: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func isPGForeignKeyViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23503"
}
