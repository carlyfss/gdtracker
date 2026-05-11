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
	if len(entries) != 48 {
		t.Fatalf("expected 48 migration files (24 up + 24 down), got %d", len(entries))
	}
}
