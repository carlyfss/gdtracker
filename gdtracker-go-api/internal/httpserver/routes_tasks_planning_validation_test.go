package httpserver

import (
	"errors"
	"testing"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/repository"
)

func TestValidatePlanningNodeDocumentKinds(t *testing.T) {
	t.Parallel()
	ids := []string{"a", "b"}
	err := validatePlanningNodeDocumentKinds(ids, map[string]string{
		"a": repository.PlanningKindMarkdown,
		"b": repository.PlanningKindExcalidraw,
	})
	if err != nil {
		t.Fatal(err)
	}
	err = validatePlanningNodeDocumentKinds(ids, map[string]string{"a": repository.PlanningKindMarkdown})
	if err == nil {
		t.Fatal("want error for missing id")
	}
	var he httpStatusErr
	if !errors.As(err, &he) || he.code != 400 {
		t.Fatalf("got %#v", err)
	}
	err = validatePlanningNodeDocumentKinds([]string{"f"}, map[string]string{"f": repository.PlanningKindFolder})
	if err == nil {
		t.Fatal("want error for folder")
	}
}
