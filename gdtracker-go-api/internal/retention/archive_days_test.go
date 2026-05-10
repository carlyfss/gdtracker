package retention

import "testing"

func TestResolveArchiveDays(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		json string
		want int64
	}{
		{"empty", "", DefaultArchiveDays},
		{"invalid json", "{", DefaultArchiveDays},
		{"missing key", `{}`, DefaultArchiveDays},
		{"null value", `{"ARCHIVE_TIME_BOMB":null}`, DefaultArchiveDays},
		{"positive number", `{"ARCHIVE_TIME_BOMB":14}`, 14},
		{"float number", `{"ARCHIVE_TIME_BOMB":7.9}`, 7},
		{"zero uses default", `{"ARCHIVE_TIME_BOMB":0}`, DefaultArchiveDays},
		{"negative uses default", `{"ARCHIVE_TIME_BOMB":-1}`, DefaultArchiveDays},
		{"string ok", `{"ARCHIVE_TIME_BOMB":"  21 "}`, 21},
		{"string invalid", `{"ARCHIVE_TIME_BOMB":"x"}`, DefaultArchiveDays},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if g := ResolveArchiveDays([]byte(tt.json)); g != tt.want {
				t.Fatalf("ResolveArchiveDays(%q) = %d, want %d", tt.json, g, tt.want)
			}
		})
	}
}
