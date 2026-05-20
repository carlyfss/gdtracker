package httpserver

import "testing"

func TestAuthModeFromEnv(t *testing.T) {
	if got := AuthModeFromEnv(""); got != AuthModeSession {
		t.Fatalf("empty = %q, want session", got)
	}
	if got := AuthModeFromEnv("auth0"); got != AuthModeAuth0 {
		t.Fatalf("auth0 = %q", got)
	}
	if got := AuthModeFromEnv("AUTH0"); got != AuthModeAuth0 {
		t.Fatalf("AUTH0 = %q", got)
	}
	if got := AuthModeFromEnv("session"); got != AuthModeSession {
		t.Fatalf("session = %q", got)
	}
}

func TestNew_requiresSessionSecretInSessionMode(t *testing.T) {
	_, err := New(Config{AuthMode: AuthModeSession, SessionSecret: ""})
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestNew_requiresAuth0ConfigInAuth0Mode(t *testing.T) {
	_, err := New(Config{AuthMode: AuthModeAuth0})
	if err == nil {
		t.Fatal("expected error")
	}
}
