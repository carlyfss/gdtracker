package httpx

import "testing"

func TestAddrFromEnv_Default(t *testing.T) {
	t.Setenv("PORT", "")
	got := AddrFromEnv("PORT", "8080")
	if got != ":8080" {
		t.Fatalf("AddrFromEnv() = %q, want %q", got, ":8080")
	}
}

func TestAddrFromEnv_EnvOverride(t *testing.T) {
	t.Setenv("PORT", "9999")
	got := AddrFromEnv("PORT", "8080")
	if got != ":9999" {
		t.Fatalf("AddrFromEnv() = %q, want %q", got, ":9999")
	}
}
