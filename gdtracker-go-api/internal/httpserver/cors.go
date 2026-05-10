package httpserver

import (
	"net/http"
	"regexp"
	"strings"
)

var defaultAllowedHeaders = []string{
	"Accept",
	"Accept-Language",
	"Content-Language",
	"Content-Type",
	"Authorization",
	"X-Requested-With",
	"X-XSRF-TOKEN",
	"X-Player-Id",
}

// CorsMiddleware applies Spring-like CORS for /api/** (allowed origin patterns, credentials, methods).
func CorsMiddleware(allowedEnv string) func(http.Handler) http.Handler {
	patterns := parseOriginPatterns(allowedEnv)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !strings.HasPrefix(r.URL.Path, "/api/") {
				next.ServeHTTP(w, r)
				return
			}
			origin := r.Header.Get("Origin")
			if origin != "" && !originAllowed(origin, patterns) {
				if r.Method == http.MethodOptions {
					w.WriteHeader(http.StatusForbidden)
					return
				}
				http.Error(w, "CORS origin not allowed", http.StatusForbidden)
				return
			}
			if origin != "" {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Add("Vary", "Origin")
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD")
			// Some browsers/proxies do not accept `Access-Control-Allow-Headers: *` reliably.
			// Prefer echoing the requested preflight headers (case-insensitive) and fall back to a safe explicit list.
			if req := strings.TrimSpace(r.Header.Get("Access-Control-Request-Headers")); req != "" {
				w.Header().Set("Access-Control-Allow-Headers", req)
			} else {
				w.Header().Set("Access-Control-Allow-Headers", strings.Join(defaultAllowedHeaders, ", "))
			}

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

type originPattern struct {
	exact string
	re    *regexp.Regexp
}

func parseOriginPatterns(allowedEnv string) []originPattern {
	s := strings.TrimSpace(allowedEnv)
	if s == "" {
		s = "http://localhost:5173"
	}
	var out []originPattern
	for _, part := range strings.Split(s, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		if strings.Contains(part, "*") {
			re := originPatternToRegexp(part)
			if re != nil {
				out = append(out, originPattern{re: re})
			}
			continue
		}
		out = append(out, originPattern{exact: part})
	}
	if len(out) == 0 {
		out = append(out, originPattern{exact: "http://localhost:5173"})
	}
	return out
}

func originPatternToRegexp(pattern string) *regexp.Regexp {
	// Single * wildcard: http://localhost:* -> ^http://localhost:.*$
	parts := strings.SplitN(pattern, "*", 2)
	if len(parts) != 2 {
		return nil
	}
	left := regexp.QuoteMeta(parts[0])
	right := regexp.QuoteMeta(parts[1])
	re, err := regexp.Compile("^" + left + ".*" + right + "$")
	if err != nil {
		return nil
	}
	return re
}

func originAllowed(origin string, patterns []originPattern) bool {
	for _, p := range patterns {
		if p.exact != "" && p.exact == origin {
			return true
		}
		if p.re != nil && p.re.MatchString(origin) {
			return true
		}
	}
	return false
}
