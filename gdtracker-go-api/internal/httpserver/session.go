package httpserver

import (
	"crypto/sha256"
	"fmt"
	"net/http"
	"strings"

	"github.com/gorilla/sessions"
)

func sessionKeyPairs(secret string) ([]byte, []byte) {
	if len(secret) < 8 {
		// Still derive fixed-length keys; caller should enforce stronger secrets.
		secret = secret + "________"
	}
	h1 := sha256.Sum256([]byte(secret))
	h2 := sha256.Sum256(append([]byte("gdtracker-go-api/sessions"), h1[:]...))
	return h1[:], h2[:]
}

func newSessionStore(secret, cookieDomain string, secure bool) (*sessions.CookieStore, error) {
	if strings.TrimSpace(secret) == "" {
		return nil, fmt.Errorf("GDTRACKER_SESSION_SECRET is required")
	}
	k1, k2 := sessionKeyPairs(secret)
	st := sessions.NewCookieStore(k1, k2)
	st.Options.Path = "/"
	st.Options.MaxAge = 1800
	st.Options.HttpOnly = true
	st.Options.Secure = secure
	st.Options.SameSite = http.SameSiteLaxMode
	if cookieDomain != "" {
		st.Options.Domain = cookieDomain
	}
	return st, nil
}
