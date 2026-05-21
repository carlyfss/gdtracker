package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestIsRateLimitExempt(t *testing.T) {
	t.Parallel()
	req := httptest.NewRequest(http.MethodOptions, "/api/games/g1/tasks", nil)
	if !isRateLimitExempt(req) {
		t.Fatal("OPTIONS should be exempt")
	}
	req = httptest.NewRequest(http.MethodGet, "/csrf", nil)
	if !isRateLimitExempt(req) {
		t.Fatal("csrf should be exempt")
	}
	req = httptest.NewRequest(http.MethodGet, "/games/g1/tasks", nil)
	if isRateLimitExempt(req) {
		t.Fatal("normal GET should not be exempt")
	}
}

func TestRateLimitTierFor(t *testing.T) {
	t.Parallel()
	req := httptest.NewRequest(http.MethodPost, "/games/g1/game-exceptions/ingest", nil)
	if rateLimitTierFor(req) != rateTierIngest {
		t.Fatal("want ingest tier")
	}
	req = httptest.NewRequest(http.MethodGet, "/games/g1/tasks", nil)
	if rateLimitTierFor(req) != rateTierRead {
		t.Fatal("want read tier")
	}
	req = httptest.NewRequest(http.MethodPost, "/games/g1/tasks", nil)
	if rateLimitTierFor(req) != rateTierWrite {
		t.Fatal("want write tier")
	}
}

func TestRateLimitStore_blocksBurst(t *testing.T) {
	t.Parallel()
	store := newRateLimitStore()
	key := "test:ip"
	perMin := 60
	allowed := 0
	for i := 0; i < 50; i++ {
		if store.allow(key, perMin) {
			allowed++
		}
	}
	if allowed < 1 {
		t.Fatal("expected at least one allowed request")
	}
	blocked := 0
	for i := 0; i < 200; i++ {
		if !store.allow(key, perMin) {
			blocked++
		}
	}
	if blocked < 1 {
		t.Fatal("expected some blocked requests under burst")
	}
}

func TestRateLimitMiddleware_returns429(t *testing.T) {
	t.Parallel()
	s := &Server{authMode: AuthModeSession}
	cfg := rateLimitConfig{enabled: true, readPerMin: 1, writePerMin: 1, ingestPerMin: 1}
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	h := RateLimitMiddleware(s, cfg)(inner)

	req := httptest.NewRequest(http.MethodGet, "/games/g1/tasks", nil)
	req.RemoteAddr = "203.0.113.1:1234"
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("first request status=%d", w.Code)
	}

	for i := 0; i < 20; i++ {
		w2 := httptest.NewRecorder()
		h.ServeHTTP(w2, req)
		if w2.Code == http.StatusTooManyRequests {
			if w2.Header().Get("Retry-After") == "" {
				t.Fatal("missing Retry-After")
			}
			return
		}
	}
	t.Fatal("expected 429 after burst")
}
