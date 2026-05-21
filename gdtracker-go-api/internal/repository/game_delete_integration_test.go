package repository

import (
	"context"
	"database/sql"
	"os"
	"testing"
	"time"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/db"
)

func TestGameSoftDeleteRestoreHardDelete_Integration(t *testing.T) {
	if os.Getenv("GDTRACKER_GO_TEST_DB") != "1" {
		t.Skip("set GDTRACKER_GO_TEST_DB=1 and DB_* to run")
	}
	t.Setenv("GDTRACKER_GO_AUTO_MIGRATE", "on")

	ctx := context.Background()
	dsn, err := db.PostgresDSNFromEnv()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.OpenPostgres(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = sqlDB.Close() }()
	if err := db.MigrateUp(ctx, sqlDB); err != nil {
		t.Fatal(err)
	}

	const (
		userID = "d0000000-0000-4000-8000-000000000000"
		gameID = "d0000000-0000-4000-8000-000000000001"
		featID = "d0000000-0000-4000-8000-000000000002"
		taskID = "d0000000-0000-4000-8000-000000000003"
	)
	now := time.Now().UTC()

	cleanup := func() {
		_, _ = sqlDB.ExecContext(ctx, `DELETE FROM tasks WHERE id = $1`, taskID)
		_, _ = sqlDB.ExecContext(ctx, `DELETE FROM features WHERE id = $1`, featID)
		_, _ = sqlDB.ExecContext(ctx, `DELETE FROM games WHERE id = $1`, gameID)
		_, _ = sqlDB.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, userID)
	}
	cleanup()
	t.Cleanup(cleanup)

	_, err = sqlDB.ExecContext(ctx,
		`INSERT INTO users (id, username, password) VALUES ($1, $2, $3)`,
		userID, "delete_user", "x",
	)
	if err != nil {
		t.Fatal(err)
	}
	_, err = sqlDB.ExecContext(ctx,
		`INSERT INTO games (id, name, user_id) VALUES ($1, $2, $3)`,
		gameID, "delete_game", userID,
	)
	if err != nil {
		t.Fatal(err)
	}
	_, err = sqlDB.ExecContext(ctx, `
INSERT INTO features (id, game_id, name, description, status, color, archived, archived_at, parent_feature_id)
VALUES ($1, $2, $3, NULL, 'TODO', '#818cf8', false, NULL, NULL)`,
		featID, gameID, "delete_feature",
	)
	if err != nil {
		t.Fatal(err)
	}
	_, err = sqlDB.ExecContext(ctx, `
INSERT INTO tasks (id, title, description, status, feature_id, created_at, updated_at, archived, archived_at, category_id, parent_task_id, source_game_exception_id)
VALUES ($1, $2, NULL, 'TODO', $3, $4, $4, false, NULL, NULL, NULL, NULL)`,
		taskID, "delete_task", featID, now,
	)
	if err != nil {
		t.Fatal(err)
	}

	games := NewGameRepository(sqlDB)

	active, err := games.ListByOwnerOrderByNameAsc(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	if len(active) != 1 || active[0].ID != gameID {
		t.Fatalf("expected one active game, got %+v", active)
	}

	tx, err := sqlDB.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := games.SoftDeleteGameTx(ctx, tx, gameID, now); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	active, err = games.ListByOwnerOrderByNameAsc(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	if len(active) != 0 {
		t.Fatalf("expected no active games after soft delete, got %+v", active)
	}

	g, err := games.FindByID(ctx, gameID)
	if err != nil {
		t.Fatal(err)
	}
	if g != nil {
		t.Fatal("FindByID should not return soft-deleted game")
	}

	deleted, err := games.ListDeletedByOwnerWithStats(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	if len(deleted) != 1 {
		t.Fatalf("expected one deleted game, got %+v", deleted)
	}
	if deleted[0].Stats.Features != 1 || deleted[0].Stats.Tasks != 1 {
		t.Fatalf("unexpected stats: %+v", deleted[0].Stats)
	}

	preview, err := games.PurgePreview(ctx, gameID, userID)
	if err != nil {
		t.Fatal(err)
	}
	if preview == nil {
		t.Fatal("expected purge preview")
	}
	if preview.Stats.Features != 1 || len(preview.Features.Items) != 1 {
		t.Fatalf("unexpected preview features: %+v", preview.Features)
	}
	if preview.Features.More != 0 {
		t.Fatalf("expected no overflow, got more=%d", preview.Features.More)
	}

	var featureDeletedAt sql.NullTime
	if err := sqlDB.QueryRowContext(ctx, `SELECT deleted_at FROM features WHERE id = $1`, featID).Scan(&featureDeletedAt); err != nil {
		t.Fatal(err)
	}
	if !featureDeletedAt.Valid {
		t.Fatal("feature should be soft-deleted")
	}

	tx, err = sqlDB.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := games.RestoreGameTx(ctx, tx, gameID); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	active, err = games.ListByOwnerOrderByNameAsc(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	if len(active) != 1 {
		t.Fatalf("expected restored active game, got %+v", active)
	}

	if err := sqlDB.QueryRowContext(ctx, `SELECT deleted_at FROM features WHERE id = $1`, featID).Scan(&featureDeletedAt); err != nil {
		t.Fatal(err)
	}
	if featureDeletedAt.Valid {
		t.Fatal("feature deleted_at should be cleared after restore")
	}

	tx, err = sqlDB.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := games.SoftDeleteGameTx(ctx, tx, gameID, now); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	tx, err = sqlDB.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := games.HardDeleteGameTx(ctx, tx, gameID); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	var n int
	if err := sqlDB.QueryRowContext(ctx, `SELECT COUNT(1) FROM games WHERE id = $1`, gameID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatal("game row should be permanently deleted")
	}
	if err := sqlDB.QueryRowContext(ctx, `SELECT COUNT(1) FROM features WHERE id = $1`, featID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatal("feature row should be permanently deleted")
	}
}
