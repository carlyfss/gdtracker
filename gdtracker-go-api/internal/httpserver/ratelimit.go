package httpserver

import (
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/httpx"
	"golang.org/x/time/rate"
)

type rateLimitTier int

const (
	rateTierRead rateLimitTier = iota
	rateTierWrite
	rateTierIngest
)

type rateLimitConfig struct {
	enabled      bool
	readPerMin   int
	writePerMin  int
	ingestPerMin int
}

func loadRateLimitConfig() rateLimitConfig {
	enabled := true
	if v := strings.TrimSpace(os.Getenv("RATE_LIMIT_ENABLED")); v != "" {
		enabled = v != "0" && !strings.EqualFold(v, "false")
	}
	return rateLimitConfig{
		enabled:      enabled,
		readPerMin:   envIntDefault("RATE_LIMIT_READ_PER_MIN", 60),
		writePerMin:  envIntDefault("RATE_LIMIT_WRITE_PER_MIN", 30),
		ingestPerMin: envIntDefault("RATE_LIMIT_INGEST_PER_MIN", 30),
	}
}

func envIntDefault(key string, def int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 1 {
		return def
	}
	return n
}

type rateLimitStore struct {
	mu       sync.Mutex
	limiters map[string]*rate.Limiter
}

func newRateLimitStore() *rateLimitStore {
	return &rateLimitStore{limiters: make(map[string]*rate.Limiter)}
}

func (s *rateLimitStore) allow(key string, perMin int) bool {
	if key == "" {
		return true
	}
	lim := rate.Every(time.Minute / time.Duration(perMin))
	burst := perMin / 2
	if burst < 1 {
		burst = 1
	}
	if burst > perMin {
		burst = perMin
	}

	s.mu.Lock()
	l, ok := s.limiters[key]
	if !ok {
		l = rate.NewLimiter(lim, burst)
		s.limiters[key] = l
	}
	s.mu.Unlock()
	return l.Allow()
}

func rateLimitTierFor(r *http.Request) rateLimitTier {
	path := r.URL.Path
	if strings.HasSuffix(path, "/ingest") {
		return rateTierIngest
	}
	if r.Method == http.MethodGet || r.Method == http.MethodHead {
		return rateTierRead
	}
	return rateTierWrite
}

func isRateLimitExempt(r *http.Request) bool {
	if r.Method == http.MethodOptions {
		return true
	}
	path := r.URL.Path
	if path == "/csrf" || path == "/auth/login" || path == "/auth/register" {
		return true
	}
	return false
}

func clientIP(r *http.Request) string {
	if xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); xff != "" {
		if i := strings.Index(xff, ","); i >= 0 {
			return strings.TrimSpace(xff[:i])
		}
		return xff
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func (s *Server) rateLimitKey(r *http.Request, tier rateLimitTier) string {
	if tier == rateTierIngest {
		gameID := r.PathValue("gameId")
		if gameID == "" {
			gameID = "_"
		}
		return "ingest:" + gameID + ":" + clientIP(r)
	}
	if uid, ok := s.tryUserID(r); ok && uid != "" {
		return "user:" + uid
	}
	return "ip:" + clientIP(r)
}

func (s *Server) tryUserID(r *http.Request) (string, bool) {
	if s.authMode == AuthModeAuth0 {
		claims, ok := s.bearerClaims(r)
		if !ok {
			return "", false
		}
		uid, _, ok := s.resolveUserFromClaims(r.Context(), claims)
		return uid, ok
	}
	if s.store == nil {
		return "", false
	}
	uid, _, ok := s.sessionUser(r)
	return uid, ok
}

func RateLimitMiddleware(s *Server, cfg rateLimitConfig) func(http.Handler) http.Handler {
	store := newRateLimitStore()
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !cfg.enabled || isRateLimitExempt(r) {
				next.ServeHTTP(w, r)
				return
			}
			tier := rateLimitTierFor(r)
			perMin := cfg.readPerMin
			switch tier {
			case rateTierWrite:
				perMin = cfg.writePerMin
			case rateTierIngest:
				perMin = cfg.ingestPerMin
			}
			key := s.rateLimitKey(r, tier)
			if !store.allow(key, perMin) {
				retryAfter := 60 / perMin
				if retryAfter < 1 {
					retryAfter = 1
				}
				w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
				httpx.WriteJSON(w, http.StatusTooManyRequests, map[string]string{
					"error": "rate limit exceeded",
				})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
