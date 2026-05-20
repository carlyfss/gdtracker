package httpserver

import (
	"context"
	"log"
	"net/http"
	"strings"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/auth/jwtauth"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/httpx"
	"github.com/google/uuid"
)

func (s *Server) bearerClaims(r *http.Request) (*jwtauth.Claims, bool) {
	if s.jwtValidator == nil {
		return nil, false
	}
	raw, err := httpx.ExtractBearerToken(r.Header.Get("Authorization"))
	if err != nil {
		return nil, false
	}
	claims, err := s.jwtValidator.Validate(r.Context(), raw)
	if err != nil {
		return nil, false
	}
	return claims, true
}

func (s *Server) resolveUserFromClaims(ctx context.Context, claims *jwtauth.Claims) (userID, username string, ok bool) {
	if s.users == nil {
		return "", "", false
	}

	if claims.GDTrackerUserID != "" {
		u, err := s.users.FindByID(ctx, claims.GDTrackerUserID)
		if err != nil {
			log.Printf("auth0: find user by claim id: %v", err)
			return "", "", false
		}
		if u != nil {
			if claims.Sub != "" && (!u.Auth0Sub.Valid || u.Auth0Sub.String != claims.Sub) {
				if err := s.users.UpdateAuth0Sub(ctx, u.ID, claims.Sub); err != nil {
					log.Printf("auth0: link auth0 sub: %v", err)
				}
			}
			return u.ID, u.Username, true
		}
	}

	if claims.Sub != "" {
		u, err := s.users.FindByAuth0Sub(ctx, claims.Sub)
		if err != nil {
			log.Printf("auth0: find user by sub: %v", err)
			return "", "", false
		}
		if u != nil {
			return u.ID, u.Username, true
		}
	}

	uname := strings.TrimSpace(claims.Username)
	if uname == "" {
		suffix := claims.Sub
		if len(suffix) > 8 {
			suffix = suffix[len(suffix)-8:]
		}
		uname = "user_" + suffix
	}

	id := uuid.NewString()
	if err := s.users.InsertAuth0(ctx, id, uname, claims.Sub); err != nil {
		log.Printf("auth0: provision user: %v", err)
		return "", "", false
	}
	return id, uname, true
}

func (s *Server) requireUserIDAuth0(w http.ResponseWriter, r *http.Request) (string, bool) {
	claims, ok := s.bearerClaims(r)
	if !ok {
		http.Error(w, "not authenticated", http.StatusUnauthorized)
		return "", false
	}
	uid, _, ok := s.resolveUserFromClaims(r.Context(), claims)
	if !ok {
		http.Error(w, "not authenticated", http.StatusUnauthorized)
		return "", false
	}
	return uid, true
}

func (s *Server) auth0User(w http.ResponseWriter, r *http.Request) (userID, username string, ok bool) {
	claims, ok := s.bearerClaims(r)
	if !ok {
		return "", "", false
	}
	return s.resolveUserFromClaims(r.Context(), claims)
}
