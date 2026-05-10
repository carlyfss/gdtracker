package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCsrfMiddleware_blocksPOSTWithoutToken(t *testing.T) {
	var innerHit bool
	inner := http.HandlerFunc(func(http.ResponseWriter, *http.Request) { innerHit = true })
	h := CsrfMiddleware("", false)(inner)

	req := httptest.NewRequest(http.MethodPost, "/api/games/abc-123/features", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}
	if innerHit {
		t.Fatal("inner handler should not run")
	}
}

func TestCsrfMiddleware_allowsPOSTLogin(t *testing.T) {
	var innerHit bool
	inner := http.HandlerFunc(func(http.ResponseWriter, *http.Request) { innerHit = true })
	h := CsrfMiddleware("", false)(inner)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if !innerHit {
		t.Fatal("inner handler should run")
	}
}

func TestCsrfMiddleware_allowsIngestPaths(t *testing.T) {
	paths := []string{
		"/api/games/g1/game-players",
		"/api/games/g1/game-events/ingest",
		"/api/games/g1/game-trace/ingest",
		"/api/games/g1/game-exceptions/ingest",
		"/api/games/g1/game-feedback/ingest",
		"/api/games/g1/integration",
	}
	for _, p := range paths {
		var hit bool
		inner := http.HandlerFunc(func(http.ResponseWriter, *http.Request) { hit = true })
		h := CsrfMiddleware("", false)(inner)
		req := httptest.NewRequest(http.MethodPost, p, nil)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK || !hit {
			t.Fatalf("path %q: code=%d hit=%v", p, rec.Code, hit)
		}
	}
}
