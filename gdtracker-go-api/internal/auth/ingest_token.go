package auth

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

const bcryptCost = 10

// VerifyIngestToken compares plaintext against the bcrypt hash stored in games.ingest_token_hash.
func VerifyIngestToken(plaintext, storedHash string) error {
	if strings.TrimSpace(plaintext) == "" {
		return fmt.Errorf("missing ingest token")
	}
	if strings.TrimSpace(storedHash) == "" {
		return fmt.Errorf("ingest token not configured")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(strings.TrimSpace(plaintext))); err != nil {
		return fmt.Errorf("invalid ingest token")
	}
	return nil
}

// HashIngestToken returns a bcrypt hash of the plaintext token (for persistence).
func HashIngestToken(plaintext string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(plaintext), bcryptCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// NewRandomIngestPlaintext returns a URL-safe Base64 token (32 raw bytes), matching GameIngestTokenService.
func NewRandomIngestPlaintext() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}
