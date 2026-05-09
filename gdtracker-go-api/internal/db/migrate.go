package db

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

//go:embed all:migrations/*.sql
var migrationFiles embed.FS

// AutoMigrateMode controls whether embedded golang-migrate runs on startup.
// Values: "auto" (default) — skip if Liquibase's databasechangelog exists; "on" — always run Up;
// "off" — never run Up. Environment variable: GDTRACKER_GO_AUTO_MIGRATE.
func AutoMigrateMode() string {
	v := strings.TrimSpace(strings.ToLower(os.Getenv("GDTRACKER_GO_AUTO_MIGRATE")))
	if v == "" {
		return "auto"
	}
	return v
}

// LiquibaseTablesPresent reports whether Liquibase has been applied to this database (same schema).
func LiquibaseTablesPresent(ctx context.Context, db *sql.DB) (bool, error) {
	var exists bool
	err := db.QueryRowContext(ctx,
		`SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = current_schema() AND table_name = 'databasechangelog'
		)`).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("liquibase table check: %w", err)
	}
	return exists, nil
}

func shouldRunMigrations(ctx context.Context, db *sql.DB) (bool, error) {
	switch AutoMigrateMode() {
	case "off", "false", "0", "no":
		return false, nil
	case "on", "true", "1", "yes":
		return true, nil
	case "auto":
		lb, err := LiquibaseTablesPresent(ctx, db)
		if err != nil {
			return false, err
		}
		// Greenfield: no Liquibase → apply embedded migrations. Existing Spring DB: skip.
		return !lb, nil
	default:
		return false, fmt.Errorf("invalid GDTRACKER_GO_AUTO_MIGRATE %q (use auto, on, or off)", os.Getenv("GDTRACKER_GO_AUTO_MIGRATE"))
	}
}

// MigrateUp applies embedded migrations when mode is "on", or in "auto" when Liquibase is absent.
// In "auto" when Liquibase is present, returns nil without running (Spring owns the schema).
func MigrateUp(ctx context.Context, db *sql.DB) error {
	run, err := shouldRunMigrations(ctx, db)
	if err != nil {
		return err
	}
	if !run {
		return nil
	}
	return migrateUpLocked(db)
}

// MigrateUpForce runs golang-migrate Up regardless of Liquibase / auto mode. Use for greenfield CLI only.
func MigrateUpForce(db *sql.DB) error {
	return migrateUpLocked(db)
}

func migrateUpLocked(db *sql.DB) error {
	src, err := iofs.New(migrationFiles, "migrations")
	if err != nil {
		return fmt.Errorf("migrate iofs source: %w", err)
	}
	driver, err := postgres.WithInstance(db, &postgres.Config{
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

	err = m.Up()
	if err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrate.Up: %w", err)
	}
	return nil
}
