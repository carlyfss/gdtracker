package httpx

import (
	"log"
	"net/http"
	"os"
)

func AddrFromEnv(envVar string, defaultPort string) string {
	port := os.Getenv(envVar)
	if port == "" {
		port = defaultPort
	}
	return ":" + port
}

func WithRequestLogging(logger *log.Logger, next http.Handler) http.Handler {
	if logger == nil {
		return next
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger.Printf("%s %s", r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
	})
}
