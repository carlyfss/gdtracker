package auth

import "testing"

func TestVerifyIngestToken_roundTrip(t *testing.T) {
	plain, err := NewRandomIngestPlaintext()
	if err != nil {
		t.Fatal(err)
	}
	hash, err := HashIngestToken(plain)
	if err != nil {
		t.Fatal(err)
	}
	if err := VerifyIngestToken(plain, hash); err != nil {
		t.Fatalf("verify: %v", err)
	}
	if err := VerifyIngestToken(plain+"x", hash); err == nil {
		t.Fatal("expected mismatch error")
	}
}

func TestVerifyIngestToken_missing(t *testing.T) {
	if err := VerifyIngestToken("", "$2a$10$"); err == nil {
		t.Fatal("expected error")
	}
}
