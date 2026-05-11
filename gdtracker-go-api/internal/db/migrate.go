package db

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

//go:embed all:migrations/*.sql
var migrationFiles embed.FS

// AutoMigrateMode controls whether embedded golang-migrate runs on startup.
// Values: "auto" (default) and "on" — run embedded migrations Up on startup; "off" — skip Up.
// Environment variable: GDTRACKER_GO_AUTO_MIGRATE.
func AutoMigrateMode() string {
	v := strings.TrimSpace(strings.ToLower(os.Getenv("GDTRACKER_GO_AUTO_MIGRATE")))
	if v == "" {
		return "auto"
	}
	return v
}

func shouldRunMigrations() (bool, error) {
	switch AutoMigrateMode() {
	case "off", "false", "0", "no":
		return false, nil
	case "auto":
		return true, nil
	case "on", "true", "1", "yes":
		return true, nil
	default:
		return false, fmt.Errorf("invalid GDTRACKER_GO_AUTO_MIGRATE %q (use auto, on, or off)", os.Getenv("GDTRACKER_GO_AUTO_MIGRATE"))
	}
}

// MigrateUp applies embedded golang-migrate migrations when mode is not "off".
func MigrateUp(_ context.Context, _ *sql.DB) error {
	run, err := shouldRunMigrations()
	if err != nil {
		return err
	}
	if !run {
		return nil
	}
	dsn, err := PostgresDSNFromEnv()
	if err != nil {
		return fmt.Errorf("migrate: postgres dsn: %w", err)
	}
	return migrateUpLocked(dsn)
}

// MigrateUpForce runs golang-migrate Up regardless of GDTRACKER_GO_AUTO_MIGRATE (including "off").
// It uses DB_URL / DB_USERNAME / DB_PASSWORD from the environment (same as the app).
func MigrateUpForce() error {
	dsn, err := PostgresDSNFromEnv()
	if err != nil {
		return fmt.Errorf("migrate: postgres dsn: %w", err)
	}
	return migrateUpLocked(dsn)
}

// migrateUpLocked opens a dedicated *sql.DB for golang-migrate. The migrate library's Close() calls
// the postgres driver's Close(), which invokes sql.DB.Close on the instance passed to WithInstance.
// Using the application's primary pool would close it after migrations and break all later queries
// ("sql: database is closed").
func migrateUpLocked(dsn string) error {
	migrateDB, err := OpenPostgres(dsn)
	if err != nil {
		return fmt.Errorf("migrate open postgres: %w", err)
	}
	defer func() { _ = migrateDB.Close() }()

	src, err := iofs.New(migrationFiles, "migrations")
	if err != nil {
		return fmt.Errorf("migrate iofs source: %w", err)
	}
	driver, err := postgres.WithInstance(migrateDB, &postgres.Config{
		MigrationsTable:       "schema_migrations",
		MultiStatementEnabled: true,
	})
	if err != nil {
		return fmt.Errorf("migrate postgres driver: %w", err)
	}
	m, err := migrate.NewWithInstance("iofs", src, "postgres", driver)
	if err != nil {
		return fmt.Errorf("migrate.NewWithInstance: %w", err)
	}
	defer func() { _, _ = m.Close() }()

	if err := maybeRepairDirtyMigration(migrateDB, m); err != nil {
		return err
	}

	err = m.Up()
	if err != nil && !errors.Is(err, migrate.ErrNoChange) {
		if strings.Contains(err.Error(), "Dirty database version") {
			return fmt.Errorf("migrate.Up: %w (set GDTRACKER_GO_MIGRATE_FORCE_VERSION to the last good version, e.g. 18, then restart once; see docs/MIGRATIONS.md)", err)
		}
		return fmt.Errorf("migrate.Up: %w", err)
	}
	return nil
}

// maybeRepairDirtyMigration runs migrate.Force when schema_migrations is dirty and
// GDTRACKER_GO_MIGRATE_FORCE_VERSION is set. If the row is not dirty, this is a no-op so
// leaving the env var set by mistake does not reset the version on every startup.
func maybeRepairDirtyMigration(db *sql.DB, m *migrate.Migrate) error {
	v := strings.TrimSpace(os.Getenv("GDTRACKER_GO_MIGRATE_FORCE_VERSION"))
	if v == "" {
		return nil
	}
	target, err := strconv.Atoi(v)
	if err != nil {
		return fmt.Errorf("GDTRACKER_GO_MIGRATE_FORCE_VERSION: invalid integer %q", v)
	}
	dirty, err := schemaMigrationDirty(db)
	if err != nil {
		return err
	}
	if !dirty {
		return nil
	}
	if err := m.Force(target); err != nil {
		return fmt.Errorf("migrate.Force(%d): %w", target, err)
	}
	return nil
}

func schemaMigrationDirty(db *sql.DB) (dirty bool, err error) {
	var version int
	var d bool
	qErr := db.QueryRow(`SELECT version, dirty FROM schema_migrations LIMIT 1`).Scan(&version, &d)
	if qErr != nil {
		if errors.Is(qErr, sql.ErrNoRows) {
			return false, nil
		}
		// First boot or table missing before first migration.
		if strings.Contains(strings.ToLower(qErr.Error()), "does not exist") {
			return false, nil
		}
		return false, qErr
	}
	return d, nil
}
