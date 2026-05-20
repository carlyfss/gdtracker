package httpserver

import (
	"net/http"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/repository"
)

func (s *Server) requireUserID(w http.ResponseWriter, r *http.Request) (string, bool) {
	if s.authMode == AuthModeAuth0 {
		return s.requireUserIDAuth0(w, r)
	}
	uid, _, ok := s.sessionUser(r)
	if !ok {
		http.Error(w, "not authenticated", http.StatusUnauthorized)
		return "", false
	}
	return uid, true
}

func (s *Server) requireOwnedGame(w http.ResponseWriter, r *http.Request, gameID string) (*repository.GameRow, bool) {
	uid, ok := s.requireUserID(w, r)
	if !ok {
		return nil, false
	}
	ctx := r.Context()
	g, err := s.games.FindByIDAndOwner(ctx, gameID, uid)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return nil, false
	}
	if g == nil {
		http.Error(w, "game not found", http.StatusNotFound)
		return nil, false
	}
	return g, true
}
