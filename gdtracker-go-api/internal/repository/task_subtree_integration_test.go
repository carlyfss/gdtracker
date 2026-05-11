package repository

import (
	"context"
	"database/sql"
	"os"
	"testing"
	"time"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/db"
)

// TestTaskSubtreeArchive_ListAndCascade_Integration locks and lists a task subtree; optionally exercises cascade archive + ListFiltered (requires Postgres).
func TestTaskSubtreeArchive_ListAndCascade_Integration(t *testing.T) {
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
		userID   = "b0000000-0000-4000-8000-000000000000"
		gameID   = "b0000000-0000-4000-8000-000000000001"
		gcID     = "b0000000-0000-4000-8000-000000000004"
		featID   = "b0000000-0000-4000-8000-000000000002"
		parentID = "b0000000-0000-4000-8000-000000000003"
		child1ID = "b0000000-0000-4000-8000-000000000005"
		child2ID = "b0000000-0000-4000-8000-000000000006"
	)
	exTmpl := `{"titleTemplate":"t","descriptionTemplate":"d","defaultCategoryId":null}`
	now := time.Now().UTC()

	_, _ = sqlDB.ExecContext(ctx, `DELETE FROM tasks WHERE id IN ($1,$2,$3)`, parentID, child1ID, child2ID)
	_, _ = sqlDB.ExecContext(ctx, `DELETE FROM features WHERE id = $1`, featID)
	_, _ = sqlDB.ExecContext(ctx, `DELETE FROM game_configurations WHERE game_id = $1`, gameID)
	_, _ = sqlDB.ExecContext(ctx, `DELETE FROM games WHERE id = $1`, gameID)
	_, _ = sqlDB.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, userID)

	_, err = sqlDB.ExecContext(ctx,
		`INSERT INTO users (id, username, password) VALUES ($1, $2, $3)`,
		userID, "subtree_task_user", "x",
	)
	if err != nil {
		t.Fatal(err)
	}
	_, err = sqlDB.ExecContext(ctx,
		`INSERT INTO games (id, name, user_id) VALUES ($1, $2, $3)`,
		gameID, "subtree_task_game", userID,
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
		featID, gameID, "subtree_feature",
	)
	if err != nil {
		t.Fatal(err)
	}

	insertTask := func(id, title string, parent sql.NullString) {
		t.Helper()
		_, err := sqlDB.ExecContext(ctx, `
INSERT INTO tasks (id, title, description, status, feature_id, created_at, updated_at, archived, archived_at, category_id, parent_task_id, source_game_exception_id)
VALUES ($1, $2, NULL, 'TODO', $3, $4, $4, false, NULL, NULL, $5, NULL)`,
			id, title, featID, now, parent,
		)
		if err != nil {
			t.Fatal(err)
		}
	}
	insertTask(parentID, "parent", sql.NullString{})
	insertTask(child1ID, "child1", sql.NullString{String: parentID, Valid: true})
	insertTask(child2ID, "child2", sql.NullString{String: parentID, Valid: true})

	repo := NewTaskRepository(sqlDB)
	tx, err := sqlDB.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	rows, err := repo.ListSubtreeTaskArchiveRowsTx(ctx, tx, parentID, gameID)
	if err != nil {
		_ = tx.Rollback()
		t.Fatal(err)
	}
	if len(rows) != 3 {
		_ = tx.Rollback()
		t.Fatalf("want 3 subtree rows, got %d (%+v)", len(rows), rows)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	archivedRepo := NewArchivedRepository(sqlDB)
	tx2, err := sqlDB.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	rows2, err := repo.ListSubtreeTaskArchiveRowsTx(ctx, tx2, parentID, gameID)
	if err != nil {
		_ = tx2.Rollback()
		t.Fatal(err)
	}
	at := time.Now().UTC()
	for _, row := range rows2 {
		af := ArchivedFeatureHintForUpsert(row.FeatureID, row.FeatureArchivedAt)
		if err := repo.SetArchivedWithTime(ctx, tx2, row.TaskID, at); err != nil {
			_ = tx2.Rollback()
			t.Fatal(err)
		}
		if err := archivedRepo.UpsertArchivedTaskTx(ctx, tx2, row.TaskID, at, af); err != nil {
			_ = tx2.Rollback()
			t.Fatal(err)
		}
	}
	if err := tx2.Commit(); err != nil {
		t.Fatal(err)
	}

	listed, err := repo.ListFiltered(ctx, TaskFilter{GameID: gameID, ArchivedOnly: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(listed) != 3 {
		t.Fatalf("archivedOnly list want 3 tasks, got %d", len(listed))
	}
}
