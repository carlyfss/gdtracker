package httpx

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestReadJSONMaxBytes_ok(t *testing.T) {
	req := httptest.NewRequest("POST", "/", strings.NewReader(`{"name":"x"}`))
	var body struct {
		Name string `json:"name"`
	}
	if err := ReadJSONMaxBytes(req, 1024, &body); err != nil {
		t.Fatal(err)
	}
	if body.Name != "x" {
		t.Fatalf("name = %q", body.Name)
	}
}

func TestReadJSONMaxBytes_rejectsUnknownField(t *testing.T) {
	req := httptest.NewRequest("POST", "/", strings.NewReader(`{"name":"x","extra":1}`))
	var body struct {
		Name string `json:"name"`
	}
	if err := ReadJSONMaxBytes(req, 1024, &body); err == nil {
		t.Fatal("expected error for unknown field")
	}
}

func TestReadJSONMaxBytes_truncatedBodyErrors(t *testing.T) {
	// JSON longer than byte limit should fail decode (simulates old 1 MiB cap vs large planning payloads).
	payload := `{"k":"` + strings.Repeat("a", 200) + `"}`
	req := httptest.NewRequest("POST", "/", strings.NewReader(payload))
	var body struct {
		K string `json:"k"`
	}
	if err := ReadJSONMaxBytes(req, 64, &body); err == nil {
		t.Fatal("expected decode error when body truncated by limit reader")
	}
}
