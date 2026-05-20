package httpserver

import "strings"

// AuthMode selects session cookies (dev) or Auth0 JWT (production).
type AuthMode string

const (
	AuthModeSession AuthMode = "session"
	AuthModeAuth0   AuthMode = "auth0"
)

func AuthModeFromEnv(raw string) AuthMode {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "auth0":
		return AuthModeAuth0
	default:
		return AuthModeSession
	}
}
