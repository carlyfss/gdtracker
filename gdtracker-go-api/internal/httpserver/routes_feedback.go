package httpserver

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/httpx"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/repository"
	"github.com/google/uuid"
)

const (
	feedbackMeterMin = 1
	feedbackMeterMax = 10
)

func (s *Server) registerFeedbackRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /games/{gameId}/game-feedback-meter-definitions", s.getFeedbackMeterDefinitions)
	mux.HandleFunc("POST /games/{gameId}/game-feedback-meter-definitions", s.postFeedbackMeterDefinition)
	mux.HandleFunc("PUT /games/{gameId}/game-feedback-meter-definitions/{id}", s.putFeedbackMeterDefinition)
	mux.HandleFunc("DELETE /games/{gameId}/game-feedback-meter-definitions/{id}", s.deleteFeedbackMeterDefinition)

	mux.HandleFunc("GET /games/{gameId}/game-feedback", s.getGameFeedbackList)
	mux.HandleFunc("GET /games/{gameId}/game-feedback/{feedbackId}", s.getGameFeedbackDetail)
	mux.HandleFunc("POST /games/{gameId}/game-feedback/ingest", s.postGameFeedbackIngest)
}

func normalizeFeedbackFieldKey(raw string) string {
	return strings.ToLower(strings.ReplaceAll(strings.TrimSpace(raw), " ", "_"))
}

func validateFeedbackFieldKey(key string) error {
	if strings.TrimSpace(key) == "" {
		return errors.New("fieldKey is required")
	}
	if !gameEventCodePattern.MatchString(key) {
		return errors.New("fieldKey must start with a letter or digit and contain only a-z, 0-9, _, -")
	}
	return nil
}

func meterDefToMap(m repository.GameFeedbackMeterDefinitionRow) map[string]any {
	return map[string]any{
		"id":        m.ID,
		"fieldKey":  m.FieldKey,
		"question":  m.Question,
		"sortOrder": m.SortOrder,
	}
}

func (s *Server) getFeedbackMeterDefinitions(w http.ResponseWriter, r *http.Request) {
	if s.feedbackMeters == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	list, err := s.feedbackMeters.ListByGameOrderBySort(r.Context(), gameID)
	if err != nil {
		log.Printf("list meter defs: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := make([]map[string]any, 0, len(list))
	for _, m := range list {
		out = append(out, meterDefToMap(m))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

type feedbackMeterUpsertBody struct {
	FieldKey  string `json:"fieldKey"`
	Question  string `json:"question"`
	SortOrder int    `json:"sortOrder"`
}

func (s *Server) postFeedbackMeterDefinition(w http.ResponseWriter, r *http.Request) {
	if s.feedbackMeters == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	var body feedbackMeterUpsertBody
	if err := httpx.ReadJSON(r, &body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	fk := normalizeFeedbackFieldKey(body.FieldKey)
	if err := validateFeedbackFieldKey(fk); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(fk) > 64 {
		http.Error(w, "fieldKey must be at most 64 characters", http.StatusBadRequest)
		return
	}
	q := strings.TrimSpace(body.Question)
	if q == "" {
		http.Error(w, "question is required", http.StatusBadRequest)
		return
	}
	if len(q) > 500 {
		http.Error(w, "question must be at most 500 characters", http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	exists, err := s.feedbackMeters.ExistsByGameAndFieldKeyIgnoreCase(ctx, gameID, fk)
	if err != nil {
		log.Printf("exists meter: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if exists {
		http.Error(w, "feedback meter field key already exists", http.StatusConflict)
		return
	}
	id := uuid.NewString()
	if err := s.feedbackMeters.Insert(ctx, id, gameID, fk, q, body.SortOrder); err != nil {
		if isPGUniqueViolation(err) {
			http.Error(w, "feedback meter field key already exists", http.StatusConflict)
			return
		}
		log.Printf("insert meter: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	m, err := s.feedbackMeters.FindByIDAndGame(ctx, id, gameID)
	if err != nil || m == nil {
		log.Printf("load meter: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, meterDefToMap(*m))
}

func (s *Server) putFeedbackMeterDefinition(w http.ResponseWriter, r *http.Request) {
	if s.feedbackMeters == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	id := r.PathValue("id")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	var body feedbackMeterUpsertBody
	if err := httpx.ReadJSON(r, &body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	fk := normalizeFeedbackFieldKey(body.FieldKey)
	if err := validateFeedbackFieldKey(fk); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(fk) > 64 {
		http.Error(w, "fieldKey must be at most 64 characters", http.StatusBadRequest)
		return
	}
	q := strings.TrimSpace(body.Question)
	if q == "" {
		http.Error(w, "question is required", http.StatusBadRequest)
		return
	}
	if len(q) > 500 {
		http.Error(w, "question must be at most 500 characters", http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	existing, err := s.feedbackMeters.FindByIDAndGame(ctx, id, gameID)
	if err != nil {
		log.Printf("find meter: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "feedback meter definition not found", http.StatusNotFound)
		return
	}
	other, err := s.feedbackMeters.FindByGameAndFieldKeyIgnoreCase(ctx, gameID, fk)
	if err != nil {
		log.Printf("find meter by key: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if other != nil && other.ID != id {
		http.Error(w, "feedback meter field key already exists", http.StatusConflict)
		return
	}
	if err := s.feedbackMeters.Update(ctx, id, gameID, fk, q, body.SortOrder); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "feedback meter definition not found", http.StatusNotFound)
			return
		}
		if isPGUniqueViolation(err) {
			http.Error(w, "feedback meter field key already exists", http.StatusConflict)
			return
		}
		log.Printf("update meter: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	m, err := s.feedbackMeters.FindByIDAndGame(ctx, id, gameID)
	if err != nil || m == nil {
		log.Printf("load meter: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, meterDefToMap(*m))
}

func (s *Server) deleteFeedbackMeterDefinition(w http.ResponseWriter, r *http.Request) {
	if s.feedbackMeters == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	id := r.PathValue("id")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	if err := s.feedbackMeters.Delete(r.Context(), id, gameID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "feedback meter definition not found", http.StatusNotFound)
			return
		}
		log.Printf("delete meter: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) getGameFeedbackList(w http.ResponseWriter, r *http.Request) {
	if s.feedbacks == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	list, err := s.feedbacks.ListByGameOrderByCreatedDesc(r.Context(), gameID)
	if err != nil {
		log.Printf("list feedback: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := make([]map[string]any, 0, len(list))
	for _, fb := range list {
		out = append(out, map[string]any{
			"id":        fb.ID,
			"title":     fb.Title,
			"playerId":  fb.GamePlayerID,
			"createdAt": fb.CreatedAt.UTC().Format(time.RFC3339Nano),
		})
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (s *Server) getGameFeedbackDetail(w http.ResponseWriter, r *http.Request) {
	if s.feedbacks == nil || s.feedbackMeters == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	fid := r.PathValue("feedbackId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	ctx := r.Context()
	fb, err := s.feedbacks.FindByIDAndGame(ctx, fid, gameID)
	if err != nil {
		log.Printf("find feedback: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if fb == nil {
		http.Error(w, "game feedback not found", http.StatusNotFound)
		return
	}
	defs, err := s.feedbackMeters.ListByGameOrderBySort(ctx, gameID)
	if err != nil {
		log.Printf("list meters: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	keyToQuestion := make(map[string]string)
	for _, d := range defs {
		keyToQuestion[strings.ToLower(d.FieldKey)] = d.Question
	}
	keys := make([]string, 0, len(fb.Meters))
	for k := range fb.Meters {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	meterArr := make([]map[string]any, 0, len(keys))
	for _, k := range keys {
		v := fb.Meters[k]
		q := keyToQuestion[strings.ToLower(k)]
		if q == "" {
			q = k
		}
		meterArr = append(meterArr, map[string]any{
			"fieldKey": k,
			"question": q,
			"value":    v,
		})
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"id":          fb.ID,
		"title":       fb.Title,
		"description": fb.Description,
		"playerId":    fb.GamePlayerID,
		"createdAt":   fb.CreatedAt.UTC().Format(time.RFC3339Nano),
		"meters":      meterArr,
	})
}

type gameFeedbackIngestBody struct {
	Title       string         `json:"title"`
	Description string         `json:"description"`
	Meters      map[string]int `json:"meters"`
}

func validateAndCanonicalizeMeters(defs []repository.GameFeedbackMeterDefinitionRow, raw map[string]int) (map[string]int, error) {
	if len(defs) == 0 {
		if len(raw) > 0 {
			return nil, fmt.Errorf("meters must be empty when no feedback template is configured")
		}
		return map[string]int{}, nil
	}
	input := raw
	if input == nil {
		input = map[string]int{}
	}
	lowerKeyToValue := make(map[string]int)
	for k, v := range input {
		if strings.TrimSpace(k) == "" {
			return nil, fmt.Errorf("meter keys must be non-blank")
		}
		low := strings.ToLower(strings.TrimSpace(k))
		if _, dup := lowerKeyToValue[low]; dup {
			return nil, fmt.Errorf("duplicate meter key in request")
		}
		lowerKeyToValue[low] = v
	}
	out := make(map[string]int)
	for _, def := range defs {
		dlow := strings.ToLower(def.FieldKey)
		val, ok := lowerKeyToValue[dlow]
		if !ok {
			return nil, fmt.Errorf("missing meter value for field: %s", def.FieldKey)
		}
		if val < feedbackMeterMin || val > feedbackMeterMax {
			return nil, fmt.Errorf("meter value for %s must be between %d and %d", def.FieldKey, feedbackMeterMin, feedbackMeterMax)
		}
		out[def.FieldKey] = val
		delete(lowerKeyToValue, dlow)
	}
	if len(lowerKeyToValue) > 0 {
		var unknown string
		for k := range lowerKeyToValue {
			unknown = k
			break
		}
		return nil, fmt.Errorf("unknown meter key: %s", unknown)
	}
	return out, nil
}

func (s *Server) postGameFeedbackIngest(w http.ResponseWriter, r *http.Request) {
	if s.feedbacks == nil || s.feedbackMeters == nil || s.gamePlayers == nil {
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
	var body gameFeedbackIngestBody
	if err := httpx.ReadJSON(r, &body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(body.Title) == "" {
		http.Error(w, "title is required", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(body.Description) == "" {
		http.Error(w, "description is required", http.StatusBadRequest)
		return
	}
	if len(body.Title) > 500 {
		http.Error(w, "title must be at most 500 characters", http.StatusBadRequest)
		return
	}
	if len(body.Description) > 20000 {
		http.Error(w, "description is too long", http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	defs, err := s.feedbackMeters.ListByGameOrderBySort(ctx, gameID)
	if err != nil {
		log.Printf("ingest list meters: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	meters, err := validateAndCanonicalizeMeters(defs, body.Meters)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	id := uuid.NewString()
	now := time.Now().UTC()
	if err := s.feedbacks.Insert(ctx, id, gameID, pid, strings.TrimSpace(body.Title), strings.TrimSpace(body.Description), meters, now); err != nil {
		log.Printf("insert feedback: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	fb, err := s.feedbacks.FindByIDAndGame(ctx, id, gameID)
	if err != nil || fb == nil {
		log.Printf("load feedback: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, feedbackEntityToMap(fb))
}

func feedbackEntityToMap(fb *repository.GameFeedbackRow) map[string]any {
	return map[string]any{
		"id":          fb.ID,
		"title":       fb.Title,
		"description": fb.Description,
		"meters":      fb.Meters,
		"createdAt":   fb.CreatedAt.UTC().Format(time.RFC3339Nano),
		"playerId":    fb.GamePlayerID,
	}
}
