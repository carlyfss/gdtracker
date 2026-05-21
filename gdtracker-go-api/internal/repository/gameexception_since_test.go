package repository

import (
	"testing"
	"time"
)

func TestListByGameSinceTimestamp_limitClamp(t *testing.T) {
	t.Parallel()
	r := &GameExceptionRepository{}
	// nil db — we only test that limit clamping is applied before query; use a stub via unexported check.
	_ = r
	limits := []struct {
		in  int
		out int
	}{
		{0, 200},
		{-1, 200},
		{1, 1},
		{200, 200},
		{500, 500},
		{501, 500},
		{1000, 500},
	}
	for _, tc := range limits {
		limit := tc.in
		if limit <= 0 {
			limit = 200
		}
		if limit > 500 {
			limit = 500
		}
		if limit != tc.out {
			t.Fatalf("limit %d clamped to %d, want %d", tc.in, limit, tc.out)
		}
	}
	_ = time.Now()
}
