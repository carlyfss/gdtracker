package httpserver

import (
	"fmt"
	"testing"
)

func TestNormalizeExamplePlaceholderValues_Empty(t *testing.T) {
	out, err := normalizeExamplePlaceholderValues(nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != 0 {
		t.Fatalf("expected empty, got %v", out)
	}
	out2, err := normalizeExamplePlaceholderValues(map[string]string{})
	if err != nil {
		t.Fatal(err)
	}
	if len(out2) != 0 {
		t.Fatalf("expected empty")
	}
}

func TestNormalizeExamplePlaceholderValues_SkipsPlayerID(t *testing.T) {
	out, err := normalizeExamplePlaceholderValues(map[string]string{
		"PLAYER_ID": "x",
		"KEY":       "gold",
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := out["PLAYER_ID"]; ok {
		t.Fatal("PLAYER_ID should not be persisted")
	}
	if out["KEY"] != "gold" {
		t.Fatalf("got %v", out)
	}
}

func TestNormalizeExamplePlaceholderValues_NormalizesKey(t *testing.T) {
	out, err := normalizeExamplePlaceholderValues(map[string]string{
		"key-name": "v",
	})
	if err != nil {
		t.Fatal(err)
	}
	if out["KEY_NAME"] != "v" {
		t.Fatalf("got %v", out)
	}
}

func TestNormalizeExamplePlaceholderValues_InvalidKey(t *testing.T) {
	_, err := normalizeExamplePlaceholderValues(map[string]string{
		"bad.key": "x",
	})
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestNormalizeExamplePlaceholderValues_TooManyKeys(t *testing.T) {
	m := make(map[string]string, maxExamplePlaceholderKeys+1)
	for i := 0; i < maxExamplePlaceholderKeys+1; i++ {
		m[fmt.Sprintf("K%d", i)] = "v"
	}
	_, err := normalizeExamplePlaceholderValues(m)
	if err == nil {
		t.Fatal("expected error")
	}
}
