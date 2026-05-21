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
	if len(entries) != 56 {
		t.Fatalf("expected 56 migration files (28 up + 28 down), got %d", len(entries))
	}
}
