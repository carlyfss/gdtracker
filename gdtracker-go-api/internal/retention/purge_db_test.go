package retention

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/db"
)

// TestPurgeExpiredArchived_Integration exercises retention deletes against real Postgres when
// GDTRACKER_GO_TEST_DB=1 and DB_URL / DB_USERNAME / DB_PASSWORD are set (disposable DB recommended).
func TestPurgeExpiredArchived_Integration(t *testing.T) {
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
		userID  = "a0000000-0000-4000-8000-000000000000"
		gameID  = "a0000000-0000-4000-8000-000000000001"
		gcID    = "a0000000-0000-4000-8000-000000000004"
		featID  = "a0000000-0000-4000-8000-000000000002"
		taskID  = "a0000000-0000-4000-8000-000000000003"
		feat2ID = "a0000000-0000-4000-8000-000000000005"
		task2ID = "a0000000-0000-4000-8000-000000000006"
	)
	exTmpl := `{"titleTemplate":"t","descriptionTemplate":"d","defaultCategoryId":null}`

	_, err = sqlDB.ExecContext(ctx, `DELETE FROM tasks WHERE id IN ($1, $2)`, taskID, task2ID)
	if err != nil {
		t.Fatal(err)
	}
	_, err = sqlDB.ExecContext(ctx, `DELETE FROM features WHERE id IN ($1, $2)`, featID, feat2ID)
	if err != nil {
		t.Fatal(err)
	}
	_, err = sqlDB.ExecContext(ctx, `DELETE FROM game_configurations WHERE game_id = $1`, gameID)
	if err != nil {
		t.Fatal(err)
	}
	_, err = sqlDB.ExecContext(ctx, `DELETE FROM games WHERE id = $1`, gameID)
	if err != nil {
		t.Fatal(err)
	}
	_, err = sqlDB.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, userID)
	if err != nil {
		t.Fatal(err)
	}

	_, err = sqlDB.ExecContext(ctx,
		`INSERT INTO users (id, username, password) VALUES ($1, $2, $3)`,
		userID, "retention_test_user", "x",
	)
	if err != nil {
		t.Fatal(err)
	}
	_, err = sqlDB.ExecContext(ctx,
		`INSERT INTO games (id, name, user_id) VALUES ($1, $2, $3)`,
		gameID, "retention_test_game", userID,
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

	old := time.Now().UTC().Add(-48 * time.Hour)
	recent := time.Now().UTC().Add(-12 * time.Hour)
	now := time.Now().UTC()

	_, err = sqlDB.ExecContext(ctx, `
INSERT INTO features (id, game_id, name, description, status, color, archived, archived_at, parent_feature_id)
VALUES ($1, $2, $3, NULL, 'TODO', '#818cf8', true, $4, NULL)`,
		featID, gameID, "old_archived_feature", old,
	)
	if err != nil {
		t.Fatal(err)
	}
	_, err = sqlDB.ExecContext(ctx, `
INSERT INTO tasks (id, title, description, status, feature_id, created_at, updated_at, archived, archived_at, category_id, parent_task_id, source_game_exception_id)
VALUES ($1, $2, NULL, 'TODO', $3, $4, $4, true, $5, NULL, NULL, NULL)`,
		taskID, "old_archived_task", featID, now, old,
	)
	if err != nil {
		t.Fatal(err)
	}

	_, err = sqlDB.ExecContext(ctx, `
INSERT INTO features (id, game_id, name, description, status, color, archived, archived_at, parent_feature_id)
VALUES ($1, $2, $3, NULL, 'TODO', '#818cf8', true, $4, NULL)`,
		feat2ID, gameID, "recent_archived_feature", recent,
	)
	if err != nil {
		t.Fatal(err)
	}
	_, err = sqlDB.ExecContext(ctx, `
INSERT INTO tasks (id, title, description, status, feature_id, created_at, updated_at, archived, archived_at, category_id, parent_task_id, source_game_exception_id)
VALUES ($1, $2, NULL, 'TODO', $3, $4, $4, true, $5, NULL, NULL, NULL)`,
		task2ID, "recent_archived_task", feat2ID, now, recent,
	)
	if err != nil {
		t.Fatal(err)
	}

	if err := PurgeExpiredArchived(ctx, sqlDB, nil); err != nil {
		t.Fatal(err)
	}

	var nTask int
	err = sqlDB.QueryRowContext(ctx, `SELECT COUNT(*) FROM tasks WHERE id = $1`, taskID).Scan(&nTask)
	if err != nil {
		t.Fatal(err)
	}
	if nTask != 0 {
		t.Fatalf("expired task should be purged, count=%d", nTask)
	}
	var nFeat int
	err = sqlDB.QueryRowContext(ctx, `SELECT COUNT(*) FROM features WHERE id = $1`, featID).Scan(&nFeat)
	if err != nil {
		t.Fatal(err)
	}
	if nFeat != 0 {
		t.Fatalf("expired feature should be purged, count=%d", nFeat)
	}

	var nTask2 int
	err = sqlDB.QueryRowContext(ctx, `SELECT COUNT(*) FROM tasks WHERE id = $1`, task2ID).Scan(&nTask2)
	if err != nil {
		t.Fatal(err)
	}
	if nTask2 != 1 {
		t.Fatalf("recent archived task should remain, count=%d", nTask2)
	}
	var nFeat2 int
	err = sqlDB.QueryRowContext(ctx, `SELECT COUNT(*) FROM features WHERE id = $1`, feat2ID).Scan(&nFeat2)
	if err != nil {
		t.Fatal(err)
	}
	if nFeat2 != 1 {
		t.Fatalf("recent archived feature should remain, count=%d", nFeat2)
	}
}
