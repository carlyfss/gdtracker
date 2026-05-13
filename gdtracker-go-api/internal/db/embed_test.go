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
	if len(entries) != 50 {
		t.Fatalf("expected 50 migration files (25 up + 25 down), got %d", len(entries))
	}
}
