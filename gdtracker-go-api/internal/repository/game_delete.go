package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

const purgePreviewSampleLimit = 50

var ErrGameNotActive = errors.New("game is not active")
var ErrGameNotDeleted = errors.New("game is not soft-deleted")

// GameDeleteStats counts related rows for a soft-deleted game.
type GameDeleteStats struct {
	Features                          int64 `json:"features"`
	Tasks                             int64 `json:"tasks"`
	Categories                        int64 `json:"categories"`
	Tags                              int64 `json:"tags"`
	GameConfigurations                int64 `json:"gameConfigurations"`
	GameExceptions                    int64 `json:"gameExceptions"`
	GameExceptionTaskSequences        int64 `json:"gameExceptionTaskSequences"`
	GameExceptionTaskSequencesPerGame int64 `json:"gameExceptionTaskSequencesPerGame"`
	GameEventTraces                   int64 `json:"gameEventTraces"`
	GameEventDefinitions              int64 `json:"gameEventDefinitions"`
	GameEvents                        int64 `json:"gameEvents"`
	GamePlayers                       int64 `json:"gamePlayers"`
	GameFeedbackMeterDefinitions      int64 `json:"gameFeedbackMeterDefinitions"`
	GameFeedback                      int64 `json:"gameFeedback"`
	PlanningNodes                     int64 `json:"planningNodes"`
	TaskPlanningDocumentRefs          int64 `json:"taskPlanningDocumentRefs"`
	TaskTags                          int64 `json:"taskTags"`
	ArchivedFeatures                  int64 `json:"archivedFeatures"`
	ArchivedTasks                     int64 `json:"archivedTasks"`
}

// DeletedGameSummary is a soft-deleted game with aggregate stats.
type DeletedGameSummary struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	DeletedAt time.Time       `json:"deletedAt"`
	Stats     GameDeleteStats `json:"stats"`
}

// CappedStringList is a sample list with total and overflow count.
type CappedStringList struct {
	Items []string `json:"items"`
	Total int64    `json:"total"`
	More  int64    `json:"more"`
}

// GamePurgePreview describes rows that would be permanently removed.
type GamePurgePreview struct {
	GameID          string           `json:"gameId"`
	Name            string           `json:"name"`
	DeletedAt       time.Time        `json:"deletedAt"`
	Stats           GameDeleteStats  `json:"stats"`
	Features        CappedStringList `json:"features"`
	Tasks           CappedStringList `json:"tasks"`
	Categories      CappedStringList `json:"categories"`
	Tags            CappedStringList `json:"tags"`
	GameExceptions  CappedStringList `json:"gameExceptions"`
	GameEvents      CappedStringList `json:"gameEvents"`
	GameEventTraces CappedStringList `json:"gameEventTraces"`
	GamePlayers     CappedStringList `json:"gamePlayers"`
	GameFeedback    CappedStringList `json:"gameFeedback"`
	PlanningNodes   CappedStringList `json:"planningNodes"`
}

func (r *GameRepository) SoftDeleteGameTx(ctx context.Context, tx *sql.Tx, gameID string, at time.Time) error {
	res, err := tx.ExecContext(ctx,
		`UPDATE games SET deleted_at = $2 WHERE id = $1 AND deleted_at IS NULL`,
		gameID, at,
	)
	if err != nil {
		return fmt.Errorf("soft delete game: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrGameNotActive
	}
	return cascadeSetDeletedAt(ctx, tx, gameID, &at)
}

func (r *GameRepository) RestoreGameTx(ctx context.Context, tx *sql.Tx, gameID string) error {
	res, err := tx.ExecContext(ctx,
		`UPDATE games SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL`,
		gameID,
	)
	if err != nil {
		return fmt.Errorf("restore game: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrGameNotDeleted
	}
	return cascadeSetDeletedAt(ctx, tx, gameID, nil)
}

func (r *GameRepository) HardDeleteGameTx(ctx context.Context, tx *sql.Tx, gameID string) error {
	var deletedAt sql.NullTime
	err := tx.QueryRowContext(ctx,
		`SELECT deleted_at FROM games WHERE id = $1`,
		gameID,
	).Scan(&deletedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrGameNotDeleted
	}
	if err != nil {
		return fmt.Errorf("hard delete lookup: %w", err)
	}
	if !deletedAt.Valid {
		return ErrGameNotDeleted
	}
	if err := hardDeleteGameData(ctx, tx, gameID); err != nil {
		return err
	}
	res, err := tx.ExecContext(ctx, `DELETE FROM games WHERE id = $1`, gameID)
	if err != nil {
		return fmt.Errorf("hard delete game: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrGameNotDeleted
	}
	return nil
}

func (r *GameRepository) ListDeletedByOwnerWithStats(ctx context.Context, ownerID string) ([]DeletedGameSummary, error) {
	rows, err := r.db.QueryContext(ctx, `
SELECT id, name, deleted_at
FROM games
WHERE user_id = $1 AND deleted_at IS NOT NULL
ORDER BY deleted_at DESC, name ASC`,
		ownerID,
	)
	if err != nil {
		return nil, fmt.Errorf("list deleted games: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var out []DeletedGameSummary
	for rows.Next() {
		var item DeletedGameSummary
		if err := rows.Scan(&item.ID, &item.Name, &item.DeletedAt); err != nil {
			return nil, err
		}
		stats, err := loadGameDeleteStats(ctx, r.db, item.ID)
		if err != nil {
			return nil, err
		}
		item.Stats = stats
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *GameRepository) PurgePreview(ctx context.Context, gameID, ownerID string) (*GamePurgePreview, error) {
	var preview GamePurgePreview
	err := r.db.QueryRowContext(ctx, `
SELECT id, name, deleted_at
FROM games
WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL`,
		gameID, ownerID,
	).Scan(&preview.GameID, &preview.Name, &preview.DeletedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("purge preview game: %w", err)
	}

	stats, err := loadGameDeleteStats(ctx, r.db, gameID)
	if err != nil {
		return nil, err
	}
	preview.Stats = stats

	preview.Features, err = loadCappedNames(ctx, r.db,
		`SELECT name FROM features WHERE game_id = $1 AND parent_feature_id IS NULL ORDER BY name ASC`, gameID)
	if err != nil {
		return nil, err
	}
	preview.Tasks, err = loadCappedNames(ctx, r.db, `
SELECT t.title FROM tasks t
JOIN features f ON f.id = t.feature_id
WHERE f.game_id = $1 AND t.parent_task_id IS NULL
ORDER BY t.title ASC`, gameID)
	if err != nil {
		return nil, err
	}
	preview.Categories, err = loadCappedNames(ctx, r.db,
		`SELECT name FROM categories WHERE game_id = $1 ORDER BY name ASC`, gameID)
	if err != nil {
		return nil, err
	}
	preview.Tags, err = loadCappedNames(ctx, r.db,
		`SELECT name FROM tags WHERE game_id = $1 ORDER BY name ASC`, gameID)
	if err != nil {
		return nil, err
	}
	preview.GameExceptions, err = loadCappedNames(ctx, r.db, `
SELECT COALESCE(NULLIF(short_error_message, ''), LEFT(stack_trace, 80), id)
FROM game_exceptions
WHERE game_id = $1
ORDER BY timestamp DESC`, gameID)
	if err != nil {
		return nil, err
	}
	preview.GameEvents, err = loadCappedNames(ctx, r.db,
		`SELECT rendered_message FROM game_events WHERE game_id = $1 ORDER BY timestamp DESC`, gameID)
	if err != nil {
		return nil, err
	}
	preview.GameEventTraces, err = loadCappedNames(ctx, r.db,
		`SELECT location FROM game_event_traces WHERE game_id = $1 ORDER BY timestamp DESC`, gameID)
	if err != nil {
		return nil, err
	}
	preview.GamePlayers, err = loadCappedNames(ctx, r.db,
		`SELECT id FROM game_players WHERE game_id = $1 ORDER BY created_at DESC`, gameID)
	if err != nil {
		return nil, err
	}
	preview.GameFeedback, err = loadCappedNames(ctx, r.db,
		`SELECT title FROM game_feedback WHERE game_id = $1 ORDER BY created_at DESC`, gameID)
	if err != nil {
		return nil, err
	}
	preview.PlanningNodes, err = loadCappedNames(ctx, r.db,
		`SELECT name FROM planning_nodes WHERE game_id = $1 ORDER BY sort_order ASC, name ASC`, gameID)
	if err != nil {
		return nil, err
	}
	return &preview, nil
}

func cascadeSetDeletedAt(ctx context.Context, tx *sql.Tx, gameID string, at *time.Time) error {
	stmts := []struct {
		label string
		query string
	}{
		{"features", `UPDATE features SET deleted_at = $2 WHERE game_id = $1`},
		{"tasks", `
UPDATE tasks SET deleted_at = $2
FROM features f
WHERE tasks.feature_id = f.id AND f.game_id = $1`},
		{"categories", `UPDATE categories SET deleted_at = $2 WHERE game_id = $1`},
		{"tags", `UPDATE tags SET deleted_at = $2 WHERE game_id = $1`},
		{"game_configurations", `UPDATE game_configurations SET deleted_at = $2 WHERE game_id = $1`},
		{"game_exceptions", `UPDATE game_exceptions SET deleted_at = $2 WHERE game_id = $1`},
		{"game_exception_task_sequences", `
UPDATE game_exception_task_sequences SET deleted_at = $2
FROM game_exceptions ge
WHERE game_exception_task_sequences.game_exception_id = ge.id AND ge.game_id = $1`},
		{"game_exception_task_sequences_per_game", `UPDATE game_exception_task_sequences_per_game SET deleted_at = $2 WHERE game_id = $1`},
		{"game_event_traces", `UPDATE game_event_traces SET deleted_at = $2 WHERE game_id = $1`},
		{"game_event_definitions", `UPDATE game_event_definitions SET deleted_at = $2 WHERE game_id = $1`},
		{"game_events", `UPDATE game_events SET deleted_at = $2 WHERE game_id = $1`},
		{"game_players", `UPDATE game_players SET deleted_at = $2 WHERE game_id = $1`},
		{"game_feedback_meter_definitions", `UPDATE game_feedback_meter_definitions SET deleted_at = $2 WHERE game_id = $1`},
		{"game_feedback", `UPDATE game_feedback SET deleted_at = $2 WHERE game_id = $1`},
		{"planning_nodes", `UPDATE planning_nodes SET deleted_at = $2 WHERE game_id = $1`},
		{"task_planning_document_refs", `
UPDATE task_planning_document_refs SET deleted_at = $2
FROM tasks t
JOIN features f ON f.id = t.feature_id
WHERE task_planning_document_refs.task_id = t.id AND f.game_id = $1`},
		{"task_tags", `
UPDATE task_tags SET deleted_at = $2
FROM tasks t
JOIN features f ON f.id = t.feature_id
WHERE task_tags.task_id = t.id AND f.game_id = $1`},
		{"archived_features", `
UPDATE archived_features SET deleted_at = $2
FROM features f
WHERE archived_features.feature_id = f.id AND f.game_id = $1`},
		{"archived_tasks", `
UPDATE archived_tasks SET deleted_at = $2
FROM tasks t
JOIN features f ON f.id = t.feature_id
WHERE archived_tasks.task_id = t.id AND f.game_id = $1`},
	}

	for _, stmt := range stmts {
		if _, err := tx.ExecContext(ctx, stmt.query, gameID, at); err != nil {
			return fmt.Errorf("cascade deleted_at on %s: %w", stmt.label, err)
		}
	}
	return nil
}

func hardDeleteGameData(ctx context.Context, tx *sql.Tx, gameID string) error {
	stmts := []struct {
		label string
		query string
	}{
		{"task_planning_document_refs", `
DELETE FROM task_planning_document_refs tpd
USING tasks t
JOIN features f ON f.id = t.feature_id
WHERE tpd.task_id = t.id AND f.game_id = $1`},
		{"task_tags", `
DELETE FROM task_tags tt
USING tasks t
JOIN features f ON f.id = t.feature_id
WHERE tt.task_id = t.id AND f.game_id = $1`},
		{"archived_tasks", `
DELETE FROM archived_tasks at
USING tasks t
JOIN features f ON f.id = t.feature_id
WHERE at.task_id = t.id AND f.game_id = $1`},
		{"game_exception_task_sequences", `
DELETE FROM game_exception_task_sequences gets
USING game_exceptions ge
WHERE gets.game_exception_id = ge.id AND ge.game_id = $1`},
		{"tasks", `
DELETE FROM tasks t
USING features f
WHERE t.feature_id = f.id AND f.game_id = $1`},
		{"archived_features", `
DELETE FROM archived_features af
USING features f
WHERE af.feature_id = f.id AND f.game_id = $1`},
		{"features", `DELETE FROM features WHERE game_id = $1`},
		{"game_event_traces", `DELETE FROM game_event_traces WHERE game_id = $1`},
		{"game_events", `DELETE FROM game_events WHERE game_id = $1`},
		{"game_feedback", `DELETE FROM game_feedback WHERE game_id = $1`},
		{"game_exceptions", `DELETE FROM game_exceptions WHERE game_id = $1`},
		{"game_players", `DELETE FROM game_players WHERE game_id = $1`},
		{"game_feedback_meter_definitions", `DELETE FROM game_feedback_meter_definitions WHERE game_id = $1`},
		{"game_event_definitions", `DELETE FROM game_event_definitions WHERE game_id = $1`},
		{"planning_nodes", `DELETE FROM planning_nodes WHERE game_id = $1`},
		{"game_exception_task_sequences_per_game", `DELETE FROM game_exception_task_sequences_per_game WHERE game_id = $1`},
		{"game_configurations", `DELETE FROM game_configurations WHERE game_id = $1`},
		{"categories", `DELETE FROM categories WHERE game_id = $1`},
		{"tags", `DELETE FROM tags WHERE game_id = $1`},
	}

	for _, stmt := range stmts {
		if _, err := tx.ExecContext(ctx, stmt.query, gameID); err != nil {
			return fmt.Errorf("hard delete %s: %w", stmt.label, err)
		}
	}
	return nil
}

type rowCounter interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func loadGameDeleteStats(ctx context.Context, db rowCounter, gameID string) (GameDeleteStats, error) {
	var stats GameDeleteStats
	queries := []struct {
		dest  *int64
		query string
	}{
		{&stats.Features, `SELECT COUNT(1) FROM features WHERE game_id = $1`},
		{&stats.Tasks, `
SELECT COUNT(1) FROM tasks t
JOIN features f ON f.id = t.feature_id
WHERE f.game_id = $1`},
		{&stats.Categories, `SELECT COUNT(1) FROM categories WHERE game_id = $1`},
		{&stats.Tags, `SELECT COUNT(1) FROM tags WHERE game_id = $1`},
		{&stats.GameConfigurations, `SELECT COUNT(1) FROM game_configurations WHERE game_id = $1`},
		{&stats.GameExceptions, `SELECT COUNT(1) FROM game_exceptions WHERE game_id = $1`},
		{&stats.GameExceptionTaskSequences, `
SELECT COUNT(1) FROM game_exception_task_sequences gets
JOIN game_exceptions ge ON ge.id = gets.game_exception_id
WHERE ge.game_id = $1`},
		{&stats.GameExceptionTaskSequencesPerGame, `SELECT COUNT(1) FROM game_exception_task_sequences_per_game WHERE game_id = $1`},
		{&stats.GameEventTraces, `SELECT COUNT(1) FROM game_event_traces WHERE game_id = $1`},
		{&stats.GameEventDefinitions, `SELECT COUNT(1) FROM game_event_definitions WHERE game_id = $1`},
		{&stats.GameEvents, `SELECT COUNT(1) FROM game_events WHERE game_id = $1`},
		{&stats.GamePlayers, `SELECT COUNT(1) FROM game_players WHERE game_id = $1`},
		{&stats.GameFeedbackMeterDefinitions, `SELECT COUNT(1) FROM game_feedback_meter_definitions WHERE game_id = $1`},
		{&stats.GameFeedback, `SELECT COUNT(1) FROM game_feedback WHERE game_id = $1`},
		{&stats.PlanningNodes, `SELECT COUNT(1) FROM planning_nodes WHERE game_id = $1`},
		{&stats.TaskPlanningDocumentRefs, `
SELECT COUNT(1) FROM task_planning_document_refs tpd
JOIN tasks t ON t.id = tpd.task_id
JOIN features f ON f.id = t.feature_id
WHERE f.game_id = $1`},
		{&stats.TaskTags, `
SELECT COUNT(1) FROM task_tags tt
JOIN tasks t ON t.id = tt.task_id
JOIN features f ON f.id = t.feature_id
WHERE f.game_id = $1`},
		{&stats.ArchivedFeatures, `
SELECT COUNT(1) FROM archived_features af
JOIN features f ON f.id = af.feature_id
WHERE f.game_id = $1`},
		{&stats.ArchivedTasks, `
SELECT COUNT(1) FROM archived_tasks at
JOIN tasks t ON t.id = at.task_id
JOIN features f ON f.id = t.feature_id
WHERE f.game_id = $1`},
	}

	for _, q := range queries {
		if err := db.QueryRowContext(ctx, q.query, gameID).Scan(q.dest); err != nil {
			return stats, fmt.Errorf("count stats: %w", err)
		}
	}
	return stats, nil
}

func loadCappedNames(ctx context.Context, db *sql.DB, query, gameID string) (CappedStringList, error) {
	var out CappedStringList
	if err := db.QueryRowContext(ctx, fmt.Sprintf(`SELECT COUNT(1) FROM (%s) s`, query), gameID).Scan(&out.Total); err != nil {
		return out, fmt.Errorf("count capped list: %w", err)
	}
	rows, err := db.QueryContext(ctx, query+fmt.Sprintf(" LIMIT %d", purgePreviewSampleLimit), gameID)
	if err != nil {
		return out, fmt.Errorf("sample capped list: %w", err)
	}
	defer func() { _ = rows.Close() }()
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return out, err
		}
		out.Items = append(out.Items, name)
	}
	if err := rows.Err(); err != nil {
		return out, err
	}
	if out.Total > int64(len(out.Items)) {
		out.More = out.Total - int64(len(out.Items))
	}
	return out, nil
}
