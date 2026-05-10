package httpserver

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCorsMiddleware_acceptsConfiguredOrigin(t *testing.T) {
	h := CorsMiddleware("http://localhost:5173")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	}))
	req := httptest.NewRequest(http.MethodGet, "/api/csrf", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusTeapot {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Fatalf("Allow-Origin = %q", got)
	}
}

func TestCorsMiddleware_optionsPreflight(t *testing.T) {
	h := CorsMiddleware("http://localhost:5173")(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("inner should not run for OPTIONS")
	}))
	req := httptest.NewRequest(http.MethodOptions, "/api/auth/login", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	req.Header.Set("Access-Control-Request-Headers", "content-type, x-xsrf-token")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d", rec.Code)
	}
	allowHeaders := strings.ToLower(rec.Header().Get("Access-Control-Allow-Headers"))
	if !strings.Contains(allowHeaders, "x-xsrf-token") {
		t.Fatalf("Allow-Headers missing x-xsrf-token: %q", rec.Header().Get("Access-Control-Allow-Headers"))
	}
	if !strings.Contains(allowHeaders, "content-type") {
		t.Fatalf("Allow-Headers missing content-type: %q", rec.Header().Get("Access-Control-Allow-Headers"))
	}
}

func TestCorsMiddleware_rejectsUnknownOrigin(t *testing.T) {
	h := CorsMiddleware("http://localhost:5173")(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("inner")
	}))
	req := httptest.NewRequest(http.MethodGet, "/api/csrf", nil)
	req.Header.Set("Origin", "https://evil.example")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d", rec.Code)
	}
}
