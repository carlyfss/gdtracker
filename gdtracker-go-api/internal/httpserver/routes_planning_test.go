package httpserver

import (
	"encoding/json"
	"testing"
)

func TestParseParentIDForPatch(t *testing.T) {
	ns, err := parseParentIDForPatch(json.RawMessage(`null`))
	if err != nil {
		t.Fatal(err)
	}
	if ns.Valid {
		t.Fatal("want root parent")
	}
	ns, err = parseParentIDForPatch(json.RawMessage(`""`))
	if err != nil {
		t.Fatal(err)
	}
	if ns.Valid {
		t.Fatal("want root")
	}
	ns, err = parseParentIDForPatch(json.RawMessage(`"  abc-123  "`))
	if err != nil {
		t.Fatal(err)
	}
	if !ns.Valid || ns.String != "abc-123" {
		t.Fatalf("got %#v", ns)
	}
	_, err = parseParentIDForPatch(json.RawMessage(`[]`))
	if err == nil {
		t.Fatal("want error")
	}
}

func TestNormalizePlanningName(t *testing.T) {
	if _, err := normalizePlanningName("  "); err == nil {
		t.Fatal("want error")
	}
	s, err := normalizePlanningName("  Hi  ")
	if err != nil || s != "Hi" {
		t.Fatalf("%q %v", s, err)
	}
}
