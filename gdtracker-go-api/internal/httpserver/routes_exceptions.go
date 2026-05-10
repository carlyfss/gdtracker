package httpserver

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/auth"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/httpx"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/repository"
	"github.com/google/uuid"
)

func (s *Server) registerExceptionRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /games/{gameId}/game-exceptions/interval", s.getGameExceptionsInterval)
	mux.HandleFunc("GET /games/{gameId}/game-exceptions/search", s.getGameExceptionsSearch)
	mux.HandleFunc("POST /games/{gameId}/game-exceptions/ingest", s.postGameExceptionIngest)
	mux.HandleFunc("GET /games/{gameId}/game-exceptions/{exceptionId}", s.getGameException)
	mux.HandleFunc("POST /games/{gameId}/game-exceptions/{exceptionId}/reserve-task-index", s.postReserveExceptionTaskIndex)
	mux.HandleFunc("GET /games/{gameId}/game-exceptions", s.getGameExceptions)
	mux.HandleFunc("POST /games/{gameId}/game-exceptions", s.postGameException)
}

func gameExceptionToMap(e repository.GameExceptionRow) map[string]any {
	m := map[string]any{
		"id":        e.ID,
		"timestamp": e.Timestamp.UTC().Format(time.RFC3339Nano),
	}
	setNull := func(key string, ns sql.NullString) {
		if ns.Valid {
			m[key] = ns.String
		} else {
			m[key] = nil
		}
	}
	setNull("errorMessage", e.ErrorMessage)
	setNull("shortErrorMessage", e.ShortErrorMessage)
	setNull("location", e.Location)
	setNull("map", e.Map)
	setNull("stackTrace", e.StackTrace)
	if e.GamePlayerID.Valid {
		m["gamePlayerId"] = e.GamePlayerID.String
	} else {
		m["gamePlayerId"] = nil
	}
	return m
}

func (s *Server) getGameExceptions(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.gameExceptions == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	list, err := s.gameExceptions.ListByGameOrderByTimestampDesc(r.Context(), gameID)
	if err != nil {
		log.Printf("list exceptions: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := make([]map[string]any, 0, len(list))
	for _, e := range list {
		out = append(out, gameExceptionToMap(e))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (s *Server) getGameExceptionsInterval(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.gameExceptions == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	fromMs, err1 := strconv.ParseInt(r.URL.Query().Get("fromMs"), 10, 64)
	toMs, err2 := strconv.ParseInt(r.URL.Query().Get("toMs"), 10, 64)
	if err1 != nil || err2 != nil || fromMs >= toMs {
		http.Error(w, "fromMs must be < toMs", http.StatusBadRequest)
		return
	}
	from := time.UnixMilli(fromMs).UTC()
	to := time.UnixMilli(toMs).UTC()
	list, err := s.gameExceptions.ListByGameAndTimestampBetween(r.Context(), gameID, from, to)
	if err != nil {
		log.Printf("list exceptions interval: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := make([]map[string]any, 0, len(list))
	for _, e := range list {
		out = append(out, gameExceptionToMap(e))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (s *Server) getGameExceptionsSearch(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.gameExceptions == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	size, _ := strconv.Atoi(r.URL.Query().Get("size"))
	pageRes, err := s.gameExceptions.SearchForGame(r.Context(), gameID, q, page, size)
	if err != nil {
		log.Printf("search exceptions: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	content := make([]map[string]any, 0, len(pageRes.Content))
	for _, e := range pageRes.Content {
		content = append(content, gameExceptionToMap(e))
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"content":       content,
		"totalElements": pageRes.TotalElements,
		"totalPages":    pageRes.TotalPages,
		"number":        pageRes.Number,
		"size":          pageRes.Size,
	})
}

func (s *Server) getGameException(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.gameExceptions == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	exID := r.PathValue("exceptionId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	e, err := s.gameExceptions.FindByIDAndGame(r.Context(), exID, gameID)
	if err != nil || e == nil {
		http.Error(w, "game exception not found", http.StatusNotFound)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, gameExceptionToMap(*e))
}

func (s *Server) postReserveExceptionTaskIndex(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	exID := r.PathValue("exceptionId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	e, err := s.gameExceptions.FindByIDAndGame(r.Context(), exID, gameID)
	if err != nil || e == nil {
		http.Error(w, "game exception not found", http.StatusNotFound)
		return
	}
	_ = e
	idx, err := repository.ReserveNextExceptionTaskIndex(r.Context(), s.db, gameID)
	if err != nil {
		log.Printf("reserve index: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]int{"index": idx})
}

type gameExceptionIngestBody struct {
	ErrorMessage      *string `json:"errorMessage"`
	Location          *string `json:"location"`
	Map               *string `json:"map"`
	StackTrace        *string `json:"stackTrace"`
	ShortErrorMessage *string `json:"shortErrorMessage"`
}

func (s *Server) postGameExceptionIngest(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.games == nil || s.gamePlayers == nil || s.gameExceptions == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	authz, err := httpx.ExtractBearerToken(r.Header.Get("Authorization"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	pid, err := httpx.RequirePlayerID(r.Header)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	g, err := s.games.FindByID(r.Context(), gameID)
	if err != nil || g == nil {
		http.Error(w, "game not found", http.StatusNotFound)
		return
	}
	hash := ""
	if g.IngestTokenHash.Valid {
		hash = g.IngestTokenHash.String
	}
	if err := auth.VerifyIngestToken(authz, hash); err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	ok, err := s.gamePlayers.ExistsByIDAndGame(r.Context(), pid, gameID)
	if err != nil || !ok {
		http.Error(w, "invalid X-Player-Id", http.StatusUnauthorized)
		return
	}
	var body gameExceptionIngestBody
	if err := httpx.ReadJSON(r, &body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	row, err := s.gameExceptions.InsertIngest(r.Context(), gameID, pid,
		sqlStringPtr(body.ErrorMessage),
		sqlStringPtr(body.ShortErrorMessage),
		sqlStringPtr(body.Location),
		sqlStringPtr(body.Map),
		sqlStringPtr(body.StackTrace),
	)
	if err != nil {
		log.Printf("ingest exception: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, gameExceptionToMap(*row))
}

type gameExceptionReportBody struct {
	ID                *string `json:"id"`
	ErrorMessage      *string `json:"errorMessage"`
	ShortErrorMessage *string `json:"shortErrorMessage"`
	Location          *string `json:"location"`
	Map               *string `json:"map"`
	StackTrace        *string `json:"stackTrace"`
}

func (s *Server) postGameException(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.gameExceptions == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	var body gameExceptionReportBody
	if err := httpx.ReadJSON(r, &body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	id := ""
	if body.ID != nil && strings.TrimSpace(*body.ID) != "" {
		id = strings.TrimSpace(*body.ID)
	} else {
		id = uuid.NewString()
	}
	row := &repository.GameExceptionRow{
		ID:                id,
		ErrorMessage:      sqlStringPtr(body.ErrorMessage),
		ShortErrorMessage: sqlStringPtr(body.ShortErrorMessage),
		Location:          sqlStringPtr(body.Location),
		Map:               sqlStringPtr(body.Map),
		StackTrace:        sqlStringPtr(body.StackTrace),
		Timestamp:         time.Now().UTC(),
	}
	saved, err := s.gameExceptions.InsertForGame(r.Context(), gameID, row)
	if err != nil {
		log.Printf("report exception: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, gameExceptionToMap(*saved))
}
