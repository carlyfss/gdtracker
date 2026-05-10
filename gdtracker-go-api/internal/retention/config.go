package retention

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// Config drives the in-process scheduler (Spring cron 0 17 3 * * * → 03:17 in configured TZ, default UTC).
type Config struct {
	Enabled  bool
	Location *time.Location
	Hour     int
	Minute   int
}

// DefaultHour and DefaultMinute match Spring ArchiveRetentionService schedule (03:17:00).
const (
	DefaultHour   = 3
	DefaultMinute = 17
)

// ConfigFromEnv builds scheduler config. If GDTRACKER_ARCHIVE_RETENTION is false/0/off, Enabled is false.
func ConfigFromEnv() Config {
	v := strings.TrimSpace(strings.ToLower(os.Getenv("GDTRACKER_ARCHIVE_RETENTION")))
	if v == "false" || v == "0" || v == "off" || v == "no" {
		return Config{Enabled: false, Location: time.UTC, Hour: DefaultHour, Minute: DefaultMinute}
	}
	tzName := strings.TrimSpace(os.Getenv("GDTRACKER_ARCHIVE_RETENTION_TIMEZONE"))
	if tzName == "" {
		tzName = "UTC"
	}
	loc, err := time.LoadLocation(tzName)
	if err != nil {
		loc = time.UTC
	}
	h := envInt("GDTRACKER_ARCHIVE_RETENTION_HOUR", DefaultHour)
	m := envInt("GDTRACKER_ARCHIVE_RETENTION_MINUTE", DefaultMinute)
	if h < 0 || h > 23 {
		h = DefaultHour
	}
	if m < 0 || m > 59 {
		m = DefaultMinute
	}
	return Config{Enabled: true, Location: loc, Hour: h, Minute: m}
}

func envInt(key string, def int) int {
	s := strings.TrimSpace(os.Getenv(key))
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}

// NextRun returns the next local time at Hour:Minute in loc after `from`.
func NextRun(from time.Time, loc *time.Location, hour, minute int) time.Time {
	now := from.In(loc)
	t := time.Date(now.Year(), now.Month(), now.Day(), hour, minute, 0, 0, loc)
	if !t.After(now) {
		t = t.Add(24 * time.Hour)
	}
	return t
}
