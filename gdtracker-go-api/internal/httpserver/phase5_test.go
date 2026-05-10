package httpserver

import (
	"testing"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/repository"
)

func TestValidateAndCanonicalizeMeters(t *testing.T) {
	defs := []repository.GameFeedbackMeterDefinitionRow{
		{FieldKey: "fun", Question: "Fun?", SortOrder: 0},
	}
	got, err := validateAndCanonicalizeMeters(defs, map[string]int{"fun": 5})
	if err != nil {
		t.Fatal(err)
	}
	if got["fun"] != 5 {
		t.Fatalf("got %#v", got)
	}
	_, err = validateAndCanonicalizeMeters(defs, map[string]int{"fun": 11})
	if err == nil {
		t.Fatal("want bounds error")
	}
	_, err = validateAndCanonicalizeMeters(defs, map[string]int{})
	if err == nil {
		t.Fatal("want missing meter")
	}
	_, err = validateAndCanonicalizeMeters(nil, map[string]int{"x": 1})
	if err == nil {
		t.Fatal("want empty template error")
	}
}

func TestNormalizeEventDefinitionCode(t *testing.T) {
	if normalizeEventDefinitionCode("  My Code ") != "my_code" {
		t.Fatal(normalizeEventDefinitionCode("  My Code "))
	}
}
