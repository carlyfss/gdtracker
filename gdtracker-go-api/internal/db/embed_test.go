package db

import (
	"io/fs"
	"testing"
)

func TestEmbeddedMigrationsCount(t *testing.T) {
	entries, err := fs.ReadDir(migrationFiles, "migrations")
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 54 {
		t.Fatalf("expected 54 migration files (27 up + 27 down), got %d", len(entries))
	}
}
