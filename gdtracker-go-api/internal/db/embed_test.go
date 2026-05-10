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
	if len(entries) != 46 {
		t.Fatalf("expected 46 migration files (23 up + 23 down), got %d", len(entries))
	}
}
