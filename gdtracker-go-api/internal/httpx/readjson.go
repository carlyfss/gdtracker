package httpx

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// ReadJSON decodes a JSON request body into v (disallow unknown fields).
func ReadJSON(r *http.Request, v any) error {
	defer func() { _ = r.Body.Close() }()
	dec := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return fmt.Errorf("json: %w", err)
	}
	return nil
}
