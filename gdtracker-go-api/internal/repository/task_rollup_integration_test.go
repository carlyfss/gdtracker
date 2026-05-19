package repository

import (
	"context"
	"database/sql"
	"os"
	"testing"
	"time"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/db"
)

func TestTaskParentStatusRollup_Integration(t *testing.T) {
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
		userID   = "c0000000-0000-4000-8000-000000000000"
		gameID   = "c0000000-0000-4000-8000-000000000001"
		gcID     = "c0000000-0000-4000-8000-000000000004"
		featID   = "c0000000-0000-4000-8000-000000000002"
		parentID = "c0000000-0000-4000-8000-000000000003"
		child1ID = "c0000000-0000-4000-8000-000000000005"
		child2ID = "c0000000-0000-4000-8000-000000000006"
	)
	exTmpl := `{"titleTemplate":"t","descriptionTemplate":"d","defaultCategoryId":null}`
	now := time.Now().UTC()

	cleanup := func() {
		_, _ = sqlDB.ExecContext(ctx, `DELETE FROM tasks WHERE id IN ($1,$2,$3)`, parentID, child1ID, child2ID)
		_, _ = sqlDB.ExecContext(ctx, `DELETE FROM features WHERE id = $1`, featID)
		_, _ = sqlDB.ExecContext(ctx, `DELETE FROM game_configurations WHERE game_id = $1`, gameID)
		_, _ = sqlDB.ExecContext(ctx, `DELETE FROM games WHERE id = $1`, gameID)
		_, _ = sqlDB.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, userID)
	}
	cleanup()
	t.Cleanup(cleanup)

	_, err = sqlDB.ExecContext(ctx,
		`INSERT INTO users (id, username, password) VALUES ($1, $2, $3)`,
		userID, "rollup_user", "x",
	)
	if err != nil {
		t.Fatal(err)
	}
	_, err = sqlDB.ExecContext(ctx,
		`INSERT INTO games (id, name, user_id) VALUES ($1, $2, $3)`,
		gameID, "rollup_game", userID,
	)
	if err != nil {
		t.Fatal(err)
	}
	_, err = sqlDB.ExecContext(ctx, `
INSERT INTO game_configurations (id, game_id, feature_flags, settings, exception_task_template)
VALUES ($1, $2, '{}'::jsonb, $3::jsonb, $4::jsonb)`,
		gcID, gameID, `{"ARCHIVE_TIME_BOMB":1}`, exTmpl,
	)
	if err != nil {
		t.Fatal(err)
	}
	_, err = sqlDB.ExecContext(ctx, `
INSERT INTO features (id, game_id, name, description, status, color, archived, archived_at, parent_feature_id)
VALUES ($1, $2, $3, NULL, 'TODO', '#818cf8', false, NULL, NULL)`,
		featID, gameID, "rollup_feature",
	)
	if err != nil {
		t.Fatal(err)
	}

	insertTask := func(id, title, status string, parent sql.NullString) {
		t.Helper()
		_, err := sqlDB.ExecContext(ctx, `
INSERT INTO tasks (id, title, description, status, feature_id, created_at, updated_at, archived, archived_at, category_id, parent_task_id, source_game_exception_id)
VALUES ($1, $2, NULL, $3, $4, $5, $5, false, NULL, NULL, $6, NULL)`,
			id, title, status, featID, now, parent,
		)
		if err != nil {
			t.Fatal(err)
		}
	}

	repo := NewTaskRepository(sqlDB)

	insertTask(parentID, "parent", "COMPLETED", sql.NullString{})
	insertTask(child1ID, "child1", "IN_PROGRESS", sql.NullString{String: parentID, Valid: true})
	insertTask(child2ID, "child2", "PENDING", sql.NullString{String: parentID, Valid: true})

	statuses, err := repo.ListActiveChildStatuses(ctx, parentID)
	if err != nil {
		t.Fatal(err)
	}
	if len(statuses) != 2 {
		t.Fatalf("want 2 child statuses, got %d", len(statuses))
	}

	tx, err := sqlDB.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	want := minStatusForTest(statuses)
	if want != "PENDING" {
		t.Fatalf("expected min PENDING, got %s", want)
	}
	if err := repo.UpdateStatusTx(ctx, tx, parentID, want); err != nil {
		_ = tx.Rollback()
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	var parentStatus string
	if err := sqlDB.QueryRowContext(ctx, `SELECT status FROM tasks WHERE id = $1`, parentID).Scan(&parentStatus); err != nil {
		t.Fatal(err)
	}
	if parentStatus != "PENDING" {
		t.Fatalf("parent status = %q, want PENDING", parentStatus)
	}

	// Archived child should not affect rollup.
	_, err = sqlDB.ExecContext(ctx,
		`UPDATE tasks SET archived = true, archived_at = $2, updated_at = $2 WHERE id = $1`,
		child2ID, now,
	)
	if err != nil {
		t.Fatal(err)
	}
	statuses, err = repo.ListActiveChildStatuses(ctx, parentID)
	if err != nil {
		t.Fatal(err)
	}
	if len(statuses) != 1 || statuses[0] != "IN_PROGRESS" {
		t.Fatalf("active children after archive: %+v", statuses)
	}
}

// minStatusForTest mirrors httpserver.minTaskStatus without importing httpserver.
func minStatusForTest(statuses []string) string {
	order := []string{"PENDING", "TODO", "IN_PROGRESS", "COMPLETED", "DONE"}
	best := -1
	for _, s := range statuses {
		for i, v := range order {
			if v == s && (best < 0 || i < best) {
				best = i
			}
		}
	}
	if best < 0 {
		return ""
	}
	return order[best]
}
