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

func TestTaskStatusRank(t *testing.T) {
	if r, ok := taskStatusRank("PENDING"); !ok || r != 0 {
		t.Fatalf("PENDING rank = %d ok=%v", r, ok)
	}
	if r, ok := taskStatusRank("DONE"); !ok || r != 4 {
		t.Fatalf("DONE rank = %d ok=%v", r, ok)
	}
	if _, ok := taskStatusRank("bogus"); ok {
		t.Fatal("expected invalid rank")
	}
}

func TestMinTaskStatus(t *testing.T) {
	tests := []struct {
		name string
		in   []string
		want string
	}{
		{"empty", nil, ""},
		{"single", []string{"TODO"}, "TODO"},
		{"min pending", []string{"DONE", "PENDING", "IN_PROGRESS"}, "PENDING"},
		{"all done", []string{"DONE", "DONE"}, "DONE"},
		{"ignore invalid", []string{"bogus", "COMPLETED"}, "COMPLETED"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := minTaskStatus(tc.in); got != tc.want {
				t.Fatalf("minTaskStatus(%v) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}
