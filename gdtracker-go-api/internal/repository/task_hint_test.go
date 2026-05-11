package repository

import (
	"database/sql"
	"testing"
	"time"
)

func TestArchivedFeatureHintForUpsert(t *testing.T) {
	fid := "feat-1"
	at := sql.NullTime{Time: time.Now().UTC(), Valid: true}
	h := ArchivedFeatureHintForUpsert(fid, at)
	if !h.Valid || h.String != fid {
		t.Fatalf("want archived feature hint for archived feature, got %#v", h)
	}
	h2 := ArchivedFeatureHintForUpsert(fid, sql.NullTime{})
	if h2.Valid {
		t.Fatalf("want empty hint when feature not archived-at, got %#v", h2)
	}
}
