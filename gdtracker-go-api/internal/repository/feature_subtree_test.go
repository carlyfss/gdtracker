package repository

import (
	"database/sql"
	"testing"
)

func TestCollectFeatureSubtreeIDs(t *testing.T) {
	a := Feature{ID: "a", ParentFeature: sql.NullString{}}
	b := Feature{ID: "b", ParentFeature: sql.NullString{String: "a", Valid: true}}
	c := Feature{ID: "c", ParentFeature: sql.NullString{String: "b", Valid: true}}
	d := Feature{ID: "d", ParentFeature: sql.NullString{}}
	all := []Feature{a, b, c, d}
	got := CollectFeatureSubtreeIDs(all, "a")
	if len(got) != 3 {
		t.Fatalf("want 3 ids, got %v", got)
	}
	want := map[string]struct{}{"a": {}, "b": {}, "c": {}}
	for _, id := range got {
		if _, ok := want[id]; !ok {
			t.Fatalf("unexpected id %s", id)
		}
	}
	got2 := CollectFeatureSubtreeIDs(all, "d")
	if len(got2) != 1 || got2[0] != "d" {
		t.Fatalf("want [d], got %v", got2)
	}
}
