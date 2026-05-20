package jwtauth

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestValidator_ValidateRS256Token(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	kid := "test-key"

	v := &Validator{
		issuer:    "https://tenant.example.com/",
		audience:  "https://api.gdtracker.example",
		keys:      map[string]crypto.PublicKey{kid: &key.PublicKey},
		fetchedAt: time.Now(),
		ttl:       time.Hour,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"sub":                      "auth0|abc123",
		"iss":                      v.issuer,
		"aud":                      v.audience,
		"exp":                      time.Now().Add(time.Hour).Unix(),
		"preferred_username":       "alice",
		customClaimGDTrackerUserID: "11111111-1111-1111-1111-111111111111",
	})
	token.Header["kid"] = kid
	raw, err := token.SignedString(key)
	if err != nil {
		t.Fatal(err)
	}

	claims, err := v.Validate(t.Context(), raw)
	if err != nil {
		t.Fatal(err)
	}
	if claims.Sub != "auth0|abc123" {
		t.Fatalf("sub = %q", claims.Sub)
	}
	if claims.Username != "alice" {
		t.Fatalf("username = %q", claims.Username)
	}
	if claims.GDTrackerUserID != "11111111-1111-1111-1111-111111111111" {
		t.Fatalf("gdtracker_user_id = %q", claims.GDTrackerUserID)
	}
}

func TestValidator_RejectsWrongAudience(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	kid := "test-key"
	v := &Validator{
		issuer:    "https://tenant.example.com/",
		audience:  "https://api.gdtracker.example",
		keys:      map[string]crypto.PublicKey{kid: &key.PublicKey},
		fetchedAt: time.Now(),
		ttl:       time.Hour,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"sub": "auth0|abc123",
		"iss": v.issuer,
		"aud": "https://wrong-audience",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	token.Header["kid"] = kid
	raw, err := token.SignedString(key)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := v.Validate(t.Context(), raw); err == nil {
		t.Fatal("expected error for wrong audience")
	}
}
