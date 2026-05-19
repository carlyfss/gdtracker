package httpserver

import (
	"encoding/json"
	"testing"
)

func TestSanitizeExamplePlaceholderMap(t *testing.T) {
	t.Parallel()
	got := sanitizeExamplePlaceholderMap(map[string]string{
		" EXCEPTION_ID ": "  abc  ",
		"EMPTY":          "",
		"":               "x",
	})
	if len(got) != 1 || got["EXCEPTION_ID"] != "abc" {
		t.Fatalf("sanitizeExamplePlaceholderMap() = %#v, want single EXCEPTION_ID=abc", got)
	}
}

func TestParseExamplePlaceholderValuesFromTpl(t *testing.T) {
	t.Parallel()
	raw := map[string]json.RawMessage{
		"examplePlaceholderValues": json.RawMessage(`{"EXCEPTION_INDEX":"03","EMPTY":""}`),
	}
	got := parseExamplePlaceholderValuesFromTpl(raw)
	if len(got) != 1 || got["EXCEPTION_INDEX"] != "03" {
		t.Fatalf("parseExamplePlaceholderValuesFromTpl() = %#v", got)
	}
}

func TestApplyExceptionTemplatePatchPreservesExamplesWhenOmitted(t *testing.T) {
	t.Parallel()
	cur, _ := json.Marshal(exceptionTplMap{
		TitleTemplate:            "T",
		DescriptionTemplate:      "D",
		ExamplePlaceholderValues: map[string]string{"EXCEPTION_ID": "keep"},
	})
	var curMap exceptionTplMap
	_ = json.Unmarshal(cur, &curMap)
	p := &exceptionTaskTemplatePatchBody{
		TitleTemplate:       "New title",
		DescriptionTemplate: "New desc",
	}
	examples := curMap.ExamplePlaceholderValues
	if p.ExamplePlaceholderValues != nil {
		examples = sanitizeExamplePlaceholderMap(p.ExamplePlaceholderValues)
	}
	if examples["EXCEPTION_ID"] != "keep" {
		t.Fatalf("expected preserved example, got %#v", examples)
	}
}
