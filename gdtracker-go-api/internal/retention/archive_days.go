package retention

import (
	"encoding/json"
	"strconv"
	"strings"
)

// ArchiveTimeBombKey matches Spring ArchiveRetentionService.ARCHIVE_TIME_BOMB.
const ArchiveTimeBombKey = "ARCHIVE_TIME_BOMB"

// DefaultArchiveDays matches Spring when setting is missing or invalid.
const DefaultArchiveDays = 30

// ResolveArchiveDays parses game_configurations.settings JSON like Spring resolveArchiveDays.
func ResolveArchiveDays(settingsJSON []byte) int64 {
	if len(settingsJSON) == 0 {
		return DefaultArchiveDays
	}
	var m map[string]any
	if err := json.Unmarshal(settingsJSON, &m); err != nil {
		return DefaultArchiveDays
	}
	raw, ok := m[ArchiveTimeBombKey]
	if !ok || raw == nil {
		return DefaultArchiveDays
	}
	switch v := raw.(type) {
	case float64:
		if v > 0 {
			return int64(v)
		}
	case string:
		n, err := strconv.ParseInt(strings.TrimSpace(v), 10, 64)
		if err == nil && n > 0 {
			return n
		}
	}
	return DefaultArchiveDays
}
