package util

import (
	"fmt"
	"regexp"
	"strings"
)

var colorHexPattern = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)

const DefaultCategoryColor = "#818cf8"

// ValidateColorHex returns lowercased #RRGGBB or an error.
func ValidateColorHex(value string) (string, error) {
	s := strings.TrimSpace(value)
	if !colorHexPattern.MatchString(s) {
		return "", fmt.Errorf("color must be a #RRGGBB hex value")
	}
	return strings.ToLower(s), nil
}

// ResolveColorForCreate applies default when raw is empty; otherwise validates.
func ResolveColorForCreate(raw, defaultHex string) (string, error) {
	if strings.TrimSpace(raw) == "" {
		return defaultHex, nil
	}
	return ValidateColorHex(raw)
}
