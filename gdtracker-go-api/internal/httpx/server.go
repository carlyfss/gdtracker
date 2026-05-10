package httpx

import (
	"log"
	"net/http"
	"os"
	"time"
)

func AddrFromEnv(envVar string, defaultPort string) string {
	port := os.Getenv(envVar)
	if port == "" {
		port = defaultPort
	}
	return ":" + port
}

// statusCapturingWriter records the HTTP status for access logs. It delegates optional
// interfaces (e.g. [http.Flusher]) to the wrapped [http.ResponseWriter] when present.
type statusCapturingWriter struct {
	http.ResponseWriter
	code int
}

func (s *statusCapturingWriter) WriteHeader(code int) {
	if s.code == 0 {
		s.code = code
	}
	s.ResponseWriter.WriteHeader(code)
}

func (s *statusCapturingWriter) Write(b []byte) (int, error) {
	if s.code == 0 {
		s.code = http.StatusOK
	}
	return s.ResponseWriter.Write(b)
}

func (s *statusCapturingWriter) Flush() {
	if f, ok := s.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func WithRequestLogging(logger *log.Logger, next http.Handler) http.Handler {
	if logger == nil {
		return next
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sw := &statusCapturingWriter{ResponseWriter: w, code: 0}
		start := time.Now()
		next.ServeHTTP(sw, r)
		code := sw.code
		if code == 0 {
			code = http.StatusOK
		}
		logger.Printf("%s %s -> %d (%s)", r.Method, r.URL.Path, code, time.Since(start).Truncate(time.Millisecond))
	})
}
