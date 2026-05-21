package httpserver

import (
	"testing"
)

func TestParseGameExceptionsSinceLimit(t *testing.T) {
	t.Parallel()
	cases := []struct {
		raw    string
		want   int
		badReq bool
	}{
		{"", 200, false},
		{"10", 10, false},
		{"500", 500, false},
		{"501", 500, false},
		{"0", 0, true},
		{"abc", 0, true},
	}
	for _, tc := range cases {
		limit, bad, err := parseGameExceptionsSinceLimit(tc.raw)
		if bad != tc.badReq {
			t.Fatalf("raw=%q badReq=%v want %v err=%v", tc.raw, bad, tc.badReq, err)
		}
		if !tc.badReq && limit != tc.want {
			t.Fatalf("raw=%q limit=%d want %d", tc.raw, limit, tc.want)
		}
	}
}
