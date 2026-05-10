package httpx

import (
	"fmt"
	"net/http"
	"strings"
)

// ExtractBearerToken parses Authorization: Bearer <token> (scheme is case-insensitive).
func ExtractBearerToken(authorization string) (string, error) {
	if strings.TrimSpace(authorization) == "" {
		return "", fmt.Errorf("missing Authorization Bearer token")
	}
	trimmed := strings.TrimSpace(authorization)
	if len(trimmed) < 7 || !strings.EqualFold(trimmed[:7], "Bearer ") {
		return "", fmt.Errorf("Authorization must use Bearer scheme")
	}
	token := strings.TrimSpace(trimmed[7:])
	if token == "" {
		return "", fmt.Errorf("missing Bearer token")
	}
	return token, nil
}

// RequirePlayerID returns X-Player-Id or a 401-style error (ingest parity).
func RequirePlayerID(h http.Header) (string, error) {
	v := strings.TrimSpace(h.Get("X-Player-Id"))
	if v == "" {
		return "", fmt.Errorf("missing X-Player-Id")
	}
	return v, nil
}
