package db

import (
	"context"
	"database/sql"
	"testing"
)

func TestShouldRunMigrations_InvalidMode(t *testing.T) {
	t.Setenv("GDTRACKER_GO_AUTO_MIGRATE", "bogus")
	dbx := &sql.DB{}
	_, err := shouldRunMigrations(context.Background(), dbx)
	if err == nil {
		t.Fatal("expected error for invalid migrate mode")
	}
}
