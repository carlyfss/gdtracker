package httpserver

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"strings"
)

const (
	csrfCookieName = "XSRF-TOKEN"
	csrfHeaderName = "X-XSRF-TOKEN"
)

// CsrfMiddleware enforces double-submit cookie/header for mutating /api requests (Spring parity).
func CsrfMiddleware(cookieDomain string, secure bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !strings.HasPrefix(r.URL.Path, "/api/") {
				next.ServeHTTP(w, r)
				return
			}
			if csrfExempt(r) {
				next.ServeHTTP(w, r)
				return
			}
			if !csrfMustCheck(r) {
				next.ServeHTTP(w, r)
				return
			}
			cookieTok, err := r.Cookie(csrfCookieName)
			if err != nil || cookieTok.Value == "" {
				http.Error(w, "CSRF token missing", http.StatusForbidden)
				return
			}
			headerTok := r.Header.Get(csrfHeaderName)
			if headerTok == "" || headerTok != cookieTok.Value {
				http.Error(w, "CSRF token mismatch", http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func csrfMustCheck(r *http.Request) bool {
	switch r.Method {
	case http.MethodGet, http.MethodHead, http.MethodOptions, http.MethodTrace:
		return false
	default:
		return true
	}
}

func csrfExempt(r *http.Request) bool {
	if r.Method == http.MethodOptions && strings.HasPrefix(r.URL.Path, "/api/") {
		return true
	}
	if r.Method != http.MethodPost {
		return false
	}
	p := r.URL.Path
	switch p {
	case "/api/auth/login", "/api/auth/register":
		return true
	}
	return matchGamePOSTSuffix(p, "game-players") ||
		matchGamePOSTSuffix(p, "game-events/ingest") ||
		matchGamePOSTSuffix(p, "game-trace/ingest") ||
		matchGamePOSTSuffix(p, "game-exceptions/ingest") ||
		matchGamePOSTSuffix(p, "game-feedback/ingest") ||
		matchGamePOSTSuffix(p, "integration")
}

func matchGamePOSTSuffix(path, suffix string) bool {
	if !strings.HasPrefix(path, "/api/games/") {
		return false
	}
	rest := strings.TrimPrefix(path, "/api/games/")
	i := strings.IndexByte(rest, '/')
	if i < 0 {
		return false
	}
	return rest[i+1:] == suffix
}

func newCSRFToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func writeCSRFCookie(w http.ResponseWriter, token, domain string, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     csrfCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   86400,
		HttpOnly: false,
		SameSite: http.SameSiteLaxMode,
		Secure:   secure,
		Domain:   domain,
	})
}

func clearCSRFCookie(w http.ResponseWriter, domain string, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     csrfCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: false,
		SameSite: http.SameSiteLaxMode,
		Secure:   secure,
		Domain:   domain,
	})
}
