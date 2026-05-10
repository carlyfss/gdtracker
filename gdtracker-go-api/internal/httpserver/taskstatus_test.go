package httpserver

import "testing"

func TestIsValidTaskStatus(t *testing.T) {
	if !isValidTaskStatus("TODO") || !isValidTaskStatus("DONE") {
		t.Fatal("expected valid")
	}
	if isValidTaskStatus("bogus") || isValidTaskStatus("") {
		t.Fatal("expected invalid")
	}
}
