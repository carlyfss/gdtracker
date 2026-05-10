package retention

import (
	"testing"
	"time"
)

func TestNextRun(t *testing.T) {
	loc := time.FixedZone("test", 0)
	// 10:00 same day → next is 15:00 same day
	from := time.Date(2026, 5, 10, 10, 0, 0, 0, loc)
	next := NextRun(from, loc, 15, 0)
	want := time.Date(2026, 5, 10, 15, 0, 0, 0, loc)
	if !next.Equal(want) {
		t.Fatalf("NextRun = %v, want %v", next, want)
	}
	// 16:00 same day → next is 15:00 next day
	from2 := time.Date(2026, 5, 10, 16, 0, 0, 0, loc)
	next2 := NextRun(from2, loc, 15, 0)
	want2 := time.Date(2026, 5, 11, 15, 0, 0, 0, loc)
	if !next2.Equal(want2) {
		t.Fatalf("NextRun = %v, want %v", next2, want2)
	}
}
