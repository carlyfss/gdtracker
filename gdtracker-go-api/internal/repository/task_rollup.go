package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// ListActiveChildStatuses returns workflow statuses of non-archived direct children.
func (r *TaskRepository) ListActiveChildStatuses(ctx context.Context, parentID string) ([]string, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT status FROM tasks WHERE parent_task_id = $1 AND archived_at IS NULL`,
		parentID,
	)
	if err != nil {
		return nil, fmt.Errorf("list active child statuses: %w", err)
	}
	defer func() { _ = rows.Close() }()
	return scanStatusRows(rows)
}

// ListActiveChildStatusesTx is the transactional variant of ListActiveChildStatuses.
func (r *TaskRepository) ListActiveChildStatusesTx(ctx context.Context, tx *sql.Tx, parentID string) ([]string, error) {
	rows, err := tx.QueryContext(ctx,
		`SELECT status FROM tasks WHERE parent_task_id = $1 AND archived_at IS NULL`,
		parentID,
	)
	if err != nil {
		return nil, fmt.Errorf("list active child statuses: %w", err)
	}
	defer func() { _ = rows.Close() }()
	return scanStatusRows(rows)
}

func scanStatusRows(rows *sql.Rows) ([]string, error) {
	var out []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// FindStatusByIDAndGameTx returns the task status when the task belongs to the game.
func (r *TaskRepository) FindStatusByIDAndGameTx(ctx context.Context, tx *sql.Tx, taskID, gameID string) (string, error) {
	var status string
	err := tx.QueryRowContext(ctx, `
SELECT t.status FROM tasks t
JOIN features f ON f.id = t.feature_id
WHERE t.id = $1 AND f.game_id = $2`,
		taskID, gameID,
	).Scan(&status)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("find task status: %w", err)
	}
	return status, nil
}

// UpdateStatusTx sets status and updated_at for a task row.
func (r *TaskRepository) UpdateStatusTx(ctx context.Context, tx *sql.Tx, taskID, status string) error {
	now := time.Now().UTC()
	_, err := tx.ExecContext(ctx,
		`UPDATE tasks SET status = $2, updated_at = $3 WHERE id = $1`,
		taskID, status, now,
	)
	if err != nil {
		return fmt.Errorf("update task status: %w", err)
	}
	return nil
}

// FindParentIDByIDTx returns parent_task_id for a task within a transaction.
func (r *TaskRepository) FindParentIDByIDTx(ctx context.Context, tx *sql.Tx, taskID string) (*string, error) {
	var p sql.NullString
	err := tx.QueryRowContext(ctx, `SELECT parent_task_id FROM tasks WHERE id = $1`, taskID).Scan(&p)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if !p.Valid {
		return nil, nil
	}
	s := p.String
	return &s, nil
}

// InsertTx inserts a task and related tags/planning refs within an existing transaction.
func (r *TaskRepository) InsertTx(ctx context.Context, tx *sql.Tx, ins TaskInsert) error {
	now := time.Now().UTC()
	id := ins.ID
	if id == "" {
		id = uuid.NewString()
		ins.ID = id
	}
	_, err := tx.ExecContext(ctx,
		`INSERT INTO tasks (id, title, description, status, feature_id, category_id, parent_task_id, source_game_exception_id,
			archived, archived_at, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,NULL,$9,$10)`,
		id, ins.Title, ins.Description, ins.Status, ins.FeatureID, ins.CategoryID, ins.ParentTaskID, ins.SourceGameExceptionID,
		now, now,
	)
	if err != nil {
		return fmt.Errorf("insert task: %w", err)
	}
	if err := replaceTaskTagsTx(ctx, tx, id, ins.TagIDs); err != nil {
		return err
	}
	if err := replaceTaskPlanningDocumentRefsTx(ctx, tx, id, ins.PlanningNodeIDs); err != nil {
		return err
	}
	return nil
}

// UpdateTx updates a task and optional tags/planning refs within an existing transaction.
func (r *TaskRepository) UpdateTx(ctx context.Context, tx *sql.Tx, u TaskUpdate) error {
	now := time.Now().UTC()
	_, err := tx.ExecContext(ctx,
		`UPDATE tasks SET title=$2, description=$3, status=$4, feature_id=$5, category_id=$6, parent_task_id=$7,
			source_game_exception_id=$8, updated_at=$9 WHERE id=$1`,
		u.ID, u.Title, u.Description, u.Status, u.FeatureID, u.CategoryID, u.ParentTaskID, u.SourceGameExceptionID, now,
	)
	if err != nil {
		return fmt.Errorf("update task: %w", err)
	}
	if u.TagIDs != nil {
		if err := replaceTaskTagsTx(ctx, tx, u.ID, *u.TagIDs); err != nil {
			return err
		}
	}
	if u.PlanningNodeIDs != nil {
		if err := replaceTaskPlanningDocumentRefsTx(ctx, tx, u.ID, *u.PlanningNodeIDs); err != nil {
			return err
		}
	}
	return nil
}

// DeleteByIDTx deletes a task within an existing transaction.
func (r *TaskRepository) DeleteByIDTx(ctx context.Context, tx *sql.Tx, id string) error {
	_, err := tx.ExecContext(ctx, `DELETE FROM tasks WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete task: %w", err)
	}
	return nil
}
