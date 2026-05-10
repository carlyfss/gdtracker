package httpserver

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/eventtemplate"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/gameeventimage"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/httpx"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/repository"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

var (
	gameEventCodePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_\-]*$`)
	eventColorHexPattern = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)
)

const (
	defaultGameEventColor     = "#818cf8"
	defaultGameEventListLimit = 200
	maxGameEventListLimit     = 500
	defaultEventSearchSize    = 10
	maxEventSearchSize        = 100
)

func (s *Server) registerGameEventRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /games/{gameId}/game-event-definitions", s.getGameEventDefinitions)
	mux.HandleFunc("POST /games/{gameId}/game-event-definitions", s.postGameEventDefinition)
	mux.HandleFunc("PUT /games/{gameId}/game-event-definitions/{id}", s.putGameEventDefinition)
	mux.HandleFunc("DELETE /games/{gameId}/game-event-definitions/{id}", s.deleteGameEventDefinition)

	mux.HandleFunc("GET /games/{gameId}/game-events/search", s.searchGameEvents)
	mux.HandleFunc("GET /games/{gameId}/game-events", s.getGameEvents)
	mux.HandleFunc("POST /games/{gameId}/game-events/ingest", s.postGameEventIngest)
}

func normalizeEventDefinitionCode(raw string) string {
	return strings.ToLower(strings.ReplaceAll(strings.TrimSpace(raw), " ", "_"))
}

func validateEventDefinitionCode(code string) error {
	if strings.TrimSpace(code) == "" {
		return errors.New("code is required")
	}
	if !gameEventCodePattern.MatchString(code) {
		return errors.New("code must start with a letter or digit and contain only a-z, 0-9, _, -")
	}
	return nil
}

func validateEventColorHex(value string) (string, error) {
	if !eventColorHexPattern.MatchString(value) {
		return "", errors.New("color must be a #RRGGBB hex value")
	}
	return strings.ToLower(value), nil
}

func resolveEventColorForCreate(raw *string) (string, error) {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return defaultGameEventColor, nil
	}
	return validateEventColorHex(strings.TrimSpace(*raw))
}

func displayNameNull(raw *string) sql.NullString {
	if raw == nil {
		return sql.NullString{}
	}
	t := strings.TrimSpace(*raw)
	if t == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: t, Valid: true}
}

func imageDataNull(raw *string) sql.NullString {
	if raw == nil {
		return sql.NullString{}
	}
	t := strings.TrimSpace(*raw)
	if t == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: t, Valid: true}
}

func gameEventDefinitionToMap(d repository.GameEventDefinitionRow) map[string]any {
	m := map[string]any{
		"id":              d.ID,
		"code":            d.Code,
		"messageTemplate": d.MessageTemplate,
		"color":           d.Color,
	}
	if d.DisplayName.Valid {
		m["displayName"] = d.DisplayName.String
	} else {
		m["displayName"] = nil
	}
	if d.ImageData.Valid {
		m["imageData"] = d.ImageData.String
	} else {
		m["imageData"] = nil
	}
	return m
}

func gameEventRowToMap(e repository.GameEventRow) map[string]any {
	m := map[string]any{
		"id":              e.ID,
		"definitionId":    e.DefinitionID,
		"definitionCode":  e.DefinitionCode,
		"definitionColor": e.DefinitionColor,
		"renderedMessage": e.RenderedMessage,
		"payload":         e.Payload,
		"timestamp":       e.Timestamp.UTC().Format(time.RFC3339Nano),
	}
	if e.GamePlayerID.Valid {
		m["playerId"] = e.GamePlayerID.String
	} else {
		m["playerId"] = nil
	}
	return m
}

type gameEventDefinitionUpsertBody struct {
	Code            string  `json:"code"`
	DisplayName     *string `json:"displayName"`
	MessageTemplate string  `json:"messageTemplate"`
	ImageData       *string `json:"imageData"`
	Color           *string `json:"color"`
}

func (s *Server) getGameEventDefinitions(w http.ResponseWriter, r *http.Request) {
	if s.gameEventDefinitions == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	list, err := s.gameEventDefinitions.ListByGameOrderByCodeAsc(r.Context(), gameID)
	if err != nil {
		log.Printf("list event definitions: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := make([]map[string]any, 0, len(list))
	for _, d := range list {
		out = append(out, gameEventDefinitionToMap(d))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (s *Server) postGameEventDefinition(w http.ResponseWriter, r *http.Request) {
	if s.gameEventDefinitions == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	var body gameEventDefinitionUpsertBody
	if err := httpx.ReadJSON(r, &body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	code := normalizeEventDefinitionCode(body.Code)
	if err := validateEventDefinitionCode(code); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(code) > 64 {
		http.Error(w, "code must be at most 64 characters", http.StatusBadRequest)
		return
	}
	dn := displayNameNull(body.DisplayName)
	if dn.Valid && len(dn.String) > 255 {
		http.Error(w, "display name must be at most 255 characters", http.StatusBadRequest)
		return
	}
	msg := strings.TrimSpace(body.MessageTemplate)
	if msg == "" {
		http.Error(w, "message template is required", http.StatusBadRequest)
		return
	}
	if len(msg) > 100 {
		http.Error(w, "message template must be at most 100 characters", http.StatusBadRequest)
		return
	}
	if err := gameeventimage.ValidateOptionalImageData(body.ImageData); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	col, err := resolveEventColorForCreate(body.Color)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	exists, err := s.gameEventDefinitions.ExistsByGameAndCodeIgnoreCase(ctx, gameID, code)
	if err != nil {
		log.Printf("exists definition: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if exists {
		http.Error(w, "game event definition code already exists", http.StatusConflict)
		return
	}
	id := uuid.NewString()
	if err := s.gameEventDefinitions.Insert(ctx, id, gameID, code, dn, msg, imageDataNull(body.ImageData), col); err != nil {
		if isPGUniqueViolation(err) {
			http.Error(w, "game event definition code already exists", http.StatusConflict)
			return
		}
		log.Printf("insert definition: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	d, err := s.gameEventDefinitions.FindByIDAndGame(ctx, id, gameID)
	if err != nil || d == nil {
		log.Printf("load definition after insert: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, gameEventDefinitionToMap(*d))
}

func (s *Server) putGameEventDefinition(w http.ResponseWriter, r *http.Request) {
	if s.gameEventDefinitions == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	id := r.PathValue("id")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	var body gameEventDefinitionUpsertBody
	if err := httpx.ReadJSON(r, &body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	code := normalizeEventDefinitionCode(body.Code)
	if err := validateEventDefinitionCode(code); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(code) > 64 {
		http.Error(w, "code must be at most 64 characters", http.StatusBadRequest)
		return
	}
	dn := displayNameNull(body.DisplayName)
	if dn.Valid && len(dn.String) > 255 {
		http.Error(w, "display name must be at most 255 characters", http.StatusBadRequest)
		return
	}
	msg := strings.TrimSpace(body.MessageTemplate)
	if msg == "" {
		http.Error(w, "message template is required", http.StatusBadRequest)
		return
	}
	if len(msg) > 100 {
		http.Error(w, "message template must be at most 100 characters", http.StatusBadRequest)
		return
	}
	if err := gameeventimage.ValidateOptionalImageData(body.ImageData); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	existing, err := s.gameEventDefinitions.FindByIDAndGame(ctx, id, gameID)
	if err != nil {
		log.Printf("find definition: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if existing == nil {
		http.Error(w, "game event definition not found", http.StatusNotFound)
		return
	}
	other, err := s.gameEventDefinitions.FindByGameAndCodeIgnoreCase(ctx, gameID, code)
	if err != nil {
		log.Printf("find definition by code: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if other != nil && other.ID != id {
		http.Error(w, "game event definition code already exists", http.StatusConflict)
		return
	}
	col := existing.Color
	if body.Color != nil && strings.TrimSpace(*body.Color) != "" {
		c, err := validateEventColorHex(strings.TrimSpace(*body.Color))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		col = c
	}
	if err := s.gameEventDefinitions.Update(ctx, id, gameID, code, dn, msg, imageDataNull(body.ImageData), col); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "game event definition not found", http.StatusNotFound)
			return
		}
		if isPGUniqueViolation(err) {
			http.Error(w, "game event definition code already exists", http.StatusConflict)
			return
		}
		log.Printf("update definition: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	d, err := s.gameEventDefinitions.FindByIDAndGame(ctx, id, gameID)
	if err != nil || d == nil {
		log.Printf("load definition: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, gameEventDefinitionToMap(*d))
}

func (s *Server) deleteGameEventDefinition(w http.ResponseWriter, r *http.Request) {
	if s.gameEventDefinitions == nil || s.gameEvents == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	id := r.PathValue("id")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	ctx := r.Context()
	d, err := s.gameEventDefinitions.FindByIDAndGame(ctx, id, gameID)
	if err != nil {
		log.Printf("find definition: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if d == nil {
		http.Error(w, "game event definition not found", http.StatusNotFound)
		return
	}
	has, err := s.gameEvents.ExistsByDefinitionID(ctx, id)
	if err != nil {
		log.Printf("exists events: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if has {
		http.Error(w, "game event definition has recorded events", http.StatusConflict)
		return
	}
	if err := s.gameEventDefinitions.Delete(ctx, id, gameID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "game event definition not found", http.StatusNotFound)
			return
		}
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23503" {
			http.Error(w, "game event definition has recorded events", http.StatusConflict)
			return
		}
		log.Printf("delete definition: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) getGameEvents(w http.ResponseWriter, r *http.Request) {
	if s.gameEvents == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	code := strings.TrimSpace(r.URL.Query().Get("code"))
	limitRaw := r.URL.Query().Get("limit")
	limit := defaultGameEventListLimit
	if limitRaw != "" {
		if v, err := strconv.Atoi(limitRaw); err == nil {
			limit = v
		}
	}
	if limit < 1 {
		limit = 1
	}
	if limit > maxGameEventListLimit {
		limit = maxGameEventListLimit
	}
	list, err := s.gameEvents.ListFiltered(r.Context(), gameID, code, q, limit)
	if err != nil {
		log.Printf("list events: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := make([]map[string]any, 0, len(list))
	for _, e := range list {
		out = append(out, gameEventRowToMap(e))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (s *Server) searchGameEvents(w http.ResponseWriter, r *http.Request) {
	if s.gameEvents == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	code := strings.TrimSpace(r.URL.Query().Get("code"))
	playerID := strings.TrimSpace(r.URL.Query().Get("playerId"))
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	size, _ := strconv.Atoi(r.URL.Query().Get("size"))
	if page < 0 {
		page = 0
	}
	if size <= 0 {
		size = defaultEventSearchSize
	}
	if size > maxEventSearchSize {
		size = maxEventSearchSize
	}
	res, err := s.gameEvents.Search(r.Context(), gameID, code, q, playerID, page, size)
	if err != nil {
		log.Printf("search events: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	content := make([]map[string]any, 0, len(res.Content))
	for _, e := range res.Content {
		content = append(content, gameEventRowToMap(e))
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"content":       content,
		"totalElements": res.TotalElements,
		"totalPages":    res.TotalPages,
		"number":        res.Number,
		"size":          res.Size,
	})
}

type gameEventIngestBody struct {
	DefinitionCode string            `json:"definitionCode"`
	Parameters     map[string]string `json:"parameters"`
}

func (s *Server) postGameEventIngest(w http.ResponseWriter, r *http.Request) {
	if s.gameEvents == nil || s.gameEventDefinitions == nil || s.gamePlayers == nil || s.gameTraces == nil {
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
	var body gameEventIngestBody
	if err := httpx.ReadJSON(r, &body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	code := strings.TrimSpace(strings.ToLower(body.DefinitionCode))
	if code == "" {
		http.Error(w, "definition code is required", http.StatusBadRequest)
		return
	}
	if len(code) > 64 {
		http.Error(w, "definition code must be at most 64 characters", http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	def, err := s.gameEventDefinitions.FindByGameAndCodeIgnoreCase(ctx, gameID, code)
	if err != nil {
		log.Printf("ingest find def: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if def == nil {
		http.Error(w, "game event definition not found", http.StatusNotFound)
		return
	}
	params := body.Parameters
	if params == nil {
		params = map[string]string{}
	}
	normalized := eventtemplate.NormalizeKeys(params)
	rawRendered, err := eventtemplate.Render(def.MessageTemplate, normalized)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	eventID := uuid.NewString()
	ts := time.Now().UTC()
	playerNull := sql.NullString{String: pid, Valid: true}
	if err := s.gameEvents.Insert(ctx, eventID, gameID, def.ID, playerNull, rawRendered, normalized, ts); err != nil {
		log.Printf("insert event: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	s.autoCreateTraceFromPayload(ctx, gameID, eventID, pid, normalized, ts)
	row, err := s.gameEvents.FindByID(ctx, eventID)
	if err != nil || row == nil {
		log.Printf("load event after ingest: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, gameEventRowToMap(*row))
}

const (
	locationKey = "LOCATION"
	mapKey      = "MAP"
)

func (s *Server) autoCreateTraceFromPayload(ctx context.Context, gameID, eventID, playerID string, payload map[string]string, ts time.Time) {
	loc := strings.TrimSpace(payload[locationKey])
	mapVal := strings.TrimSpace(payload[mapKey])
	if loc == "" || mapVal == "" {
		return
	}
	traceID := uuid.NewString()
	playerNull := sql.NullString{String: playerID, Valid: true}
	eventNull := sql.NullString{String: eventID, Valid: true}
	if err := s.gameTraces.Insert(ctx, traceID, gameID, loc, mapVal, playerNull, eventNull, ts); err != nil {
		log.Printf("auto trace: %v", err)
	}
}
