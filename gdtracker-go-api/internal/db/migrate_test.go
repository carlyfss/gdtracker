package db

import (
	"testing"
)

func TestShouldRunMigrations_InvalidMode(t *testing.T) {
	t.Setenv("GDTRACKER_GO_AUTO_MIGRATE", "bogus")
	_, err := shouldRunMigrations()
	if err == nil {
		t.Fatal("expected error for invalid migrate mode")
	}
}

func TestShouldRunMigrations_AutoRuns(t *testing.T) {
	t.Setenv("GDTRACKER_GO_AUTO_MIGRATE", "auto")
	run, err := shouldRunMigrations()
	if err != nil {
		t.Fatal(err)
	}
	if !run {
		t.Fatal("expected auto to run migrations")
	}
}

func TestShouldRunMigrations_OffSkips(t *testing.T) {
	t.Setenv("GDTRACKER_GO_AUTO_MIGRATE", "off")
	run, err := shouldRunMigrations()
	if err != nil {
		t.Fatal(err)
	}
	if run {
		t.Fatal("expected off to skip migrations")
	}
}
