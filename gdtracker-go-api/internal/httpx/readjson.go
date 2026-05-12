package httpx

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// DefaultMaxJSONBodyBytes is the historical 1 MiB cap for most JSON mutation handlers.
const DefaultMaxJSONBodyBytes = 1 << 20

// LargePlanningJSONBodyBytes allows planning create/update bodies that include up to ~4 MiB
// excalidrawScene plus JSON wrapper fields (see internal/httpserver/routes_planning.go maxPlanningExcalidraw).
const LargePlanningJSONBodyBytes = 5 << 20

// ReadJSON decodes a JSON request body into v (disallow unknown fields) with DefaultMaxJSONBodyBytes.
func ReadJSON(r *http.Request, v any) error {
	return ReadJSONMaxBytes(r, DefaultMaxJSONBodyBytes, v)
}

// ReadJSONMaxBytes decodes a JSON request body into v (disallow unknown fields) with a caller-chosen max size.
func ReadJSONMaxBytes(r *http.Request, maxBytes int64, v any) error {
	defer func() { _ = r.Body.Close() }()
	dec := json.NewDecoder(io.LimitReader(r.Body, maxBytes))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return fmt.Errorf("json: %w", err)
	}
	return nil
}
