package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

// TaskListRow is a task joined with its feature (for JSON responses).
type TaskListRow struct {
	TaskID                string
	Title                 string
	Description           sql.NullString
	Status                string
	CategoryID            sql.NullString
	ParentTaskID          sql.NullString
	SourceGameExceptionID sql.NullString
	CreatedAt             time.Time
	UpdatedAt             time.Time
	Archived              bool
	ArchivedAt            sql.NullTime
	Feature               Feature
}

type TaskRepository struct {
	db *sql.DB
}

func NewTaskRepository(db *sql.DB) *TaskRepository {
	return &TaskRepository{db: db}
}

type TaskFilter struct {
	GameID                string
	FeatureID             *string
	Status                *string
	CategoryID            *string
	SourceGameExceptionID *string
	ArchivedOnly          bool
	TagIDs                []string
	TagModeAll            bool
}

func (r *TaskRepository) ListFiltered(ctx context.Context, f TaskFilter) ([]TaskListRow, error) {
	base := strings.Builder{}
	base.WriteString(`
SELECT t.id, t.title, t.description, t.status, t.category_id, t.parent_task_id, t.source_game_exception_id,
       t.created_at, t.updated_at, t.archived, t.archived_at,
       f.id, f.game_id, f.name, f.description, f.status, f.color, f.archived, f.archived_at, f.parent_feature_id
FROM tasks t
JOIN features f ON f.id = t.feature_id
WHERE f.game_id = $1`)

	args := []interface{}{f.GameID}
	n := 2

	add := func(cond string, arg interface{}) {
		base.WriteString(cond)
		args = append(args, arg)
		n++
	}

	if f.FeatureID != nil && *f.FeatureID != "" {
		add(fmt.Sprintf(" AND t.feature_id = $%d", n), *f.FeatureID)
	}
	if f.Status != nil && *f.Status != "" {
		add(fmt.Sprintf(" AND t.status = $%d", n), *f.Status)
	}
	if f.CategoryID != nil && *f.CategoryID != "" {
		add(fmt.Sprintf(" AND t.category_id IS NOT NULL AND t.category_id = $%d", n), *f.CategoryID)
	}
	if f.SourceGameExceptionID != nil && *f.SourceGameExceptionID != "" {
		add(fmt.Sprintf(" AND t.source_game_exception_id IS NOT NULL AND t.source_game_exception_id = $%d", n), *f.SourceGameExceptionID)
	}
	if f.ArchivedOnly {
		base.WriteString(" AND (t.archived_at IS NOT NULL OR f.archived_at IS NOT NULL)")
	} else {
		base.WriteString(" AND t.archived_at IS NULL AND f.archived_at IS NULL")
	}

	if len(f.TagIDs) > 0 {
		if f.TagModeAll {
			base.WriteString(fmt.Sprintf(`
AND (SELECT COUNT(DISTINCT tt.tag_id) FROM task_tags tt WHERE tt.task_id = t.id AND tt.tag_id = ANY($%d::text[])) = $%d`,
				n, n+1))
			args = append(args, pq.Array(f.TagIDs), len(f.TagIDs))
			n += 2
		} else {
			base.WriteString(fmt.Sprintf(`
AND EXISTS (SELECT 1 FROM task_tags tt WHERE tt.task_id = t.id AND tt.tag_id = ANY($%d::text[]))`, n))
			args = append(args, pq.Array(f.TagIDs))
			n++
		}
	}

	base.WriteString(` ORDER BY t.created_at DESC`)

	rows, err := r.db.QueryContext(ctx, base.String(), args...)
	if err != nil {
		return nil, fmt.Errorf("list tasks: %w", err)
	}
	defer func() { _ = rows.Close() }()
	return scanTaskListRows(rows)
}

func scanTaskListRows(rows *sql.Rows) ([]TaskListRow, error) {
	var out []TaskListRow
	for rows.Next() {
		var tr TaskListRow
		var f Feature
		err := rows.Scan(
			&tr.TaskID, &tr.Title, &tr.Description, &tr.Status, &tr.CategoryID, &tr.ParentTaskID, &tr.SourceGameExceptionID,
			&tr.CreatedAt, &tr.UpdatedAt, &tr.Archived, &tr.ArchivedAt,
			&f.ID, &f.GameID, &f.Name, &f.Description, &f.Status, &f.Color, &f.Archived, &f.ArchivedAt, &f.ParentFeature,
		)
		if err != nil {
			return nil, err
		}
		tr.Feature = f
		out = append(out, tr)
	}
	return out, rows.Err()
}

func (r *TaskRepository) FindByIDAndGame(ctx context.Context, taskID, gameID string) (*TaskListRow, error) {
	row := r.db.QueryRowContext(ctx, `
SELECT t.id, t.title, t.description, t.status, t.category_id, t.parent_task_id, t.source_game_exception_id,
       t.created_at, t.updated_at, t.archived, t.archived_at,
       f.id, f.game_id, f.name, f.description, f.status, f.color, f.archived, f.archived_at, f.parent_feature_id
FROM tasks t
JOIN features f ON f.id = t.feature_id
WHERE t.id = $1 AND f.game_id = $2`, taskID, gameID)
	var tr TaskListRow
	var f Feature
	err := row.Scan(
		&tr.TaskID, &tr.Title, &tr.Description, &tr.Status, &tr.CategoryID, &tr.ParentTaskID, &tr.SourceGameExceptionID,
		&tr.CreatedAt, &tr.UpdatedAt, &tr.Archived, &tr.ArchivedAt,
		&f.ID, &f.GameID, &f.Name, &f.Description, &f.Status, &f.Color, &f.Archived, &f.ArchivedAt, &f.ParentFeature,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find task: %w", err)
	}
	tr.Feature = f
	return &tr, nil
}

func (r *TaskRepository) FindParentIDByID(ctx context.Context, taskID string) (*string, error) {
	var p sql.NullString
	err := r.db.QueryRowContext(ctx, `SELECT parent_task_id FROM tasks WHERE id = $1`, taskID).Scan(&p)
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

type TaskInsert struct {
	ID                    string
	Title                 string
	Description           sql.NullString
	Status                string
	FeatureID             string
	CategoryID            sql.NullString
	ParentTaskID          sql.NullString
	SourceGameExceptionID sql.NullString
	TagIDs                []string
}

func (r *TaskRepository) Insert(ctx context.Context, ins TaskInsert) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	now := time.Now().UTC()
	id := ins.ID
	if id == "" {
		id = uuid.NewString()
	}
	_, err = tx.ExecContext(ctx,
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
	return tx.Commit()
}

type TaskUpdate struct {
	ID                    string
	Title                 string
	Description           sql.NullString
	Status                string
	FeatureID             string
	CategoryID            sql.NullString
	ParentTaskID          sql.NullString
	SourceGameExceptionID sql.NullString
	TagIDs                *[]string
}

func (r *TaskRepository) Update(ctx context.Context, u TaskUpdate) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	now := time.Now().UTC()
	_, err = tx.ExecContext(ctx,
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
	return tx.Commit()
}

func replaceTaskTagsTx(ctx context.Context, tx *sql.Tx, taskID string, tagIDs []string) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM task_tags WHERE task_id = $1`, taskID); err != nil {
		return fmt.Errorf("clear task_tags: %w", err)
	}
	for _, tid := range tagIDs {
		if tid == "" {
			continue
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2)`, taskID, tid); err != nil {
			return fmt.Errorf("insert task_tag: %w", err)
		}
	}
	return nil
}

func (r *TaskRepository) DeleteByID(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM tasks WHERE id = $1`, id)
	return err
}

func (r *TaskRepository) SetArchived(ctx context.Context, taskID string, at time.Time) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE tasks SET archived = true, archived_at = $2, updated_at = $2 WHERE id = $1`,
		taskID, at,
	)
	return err
}

func (r *TaskRepository) ClearArchived(ctx context.Context, taskID string) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE tasks SET archived = false, archived_at = NULL, updated_at = $2 WHERE id = $1`,
		taskID, now,
	)
	return err
}

func (r *TaskRepository) UpdateFeatureID(ctx context.Context, taskID, featureID string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE tasks SET feature_id = $2, updated_at = $3 WHERE id = $1`, taskID, featureID, time.Now().UTC())
	return err
}

// LoadTagsForTasks returns tag_id -> tags for each task (ordered by tag name ASC per task).
func (r *TaskRepository) LoadTagsForTasks(ctx context.Context, taskIDs []string) (map[string][]Tag, error) {
	if len(taskIDs) == 0 {
		return map[string][]Tag{}, nil
	}
	rows, err := r.db.QueryContext(ctx, `
SELECT tt.task_id, tg.id, tg.game_id, tg.name, tg.color, tg.description
FROM task_tags tt
JOIN tags tg ON tg.id = tt.tag_id
WHERE tt.task_id = ANY($1::text[])
ORDER BY tt.task_id, tg.name ASC`, pq.Array(taskIDs))
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	out := make(map[string][]Tag)
	for rows.Next() {
		var taskID string
		var t Tag
		if err := rows.Scan(&taskID, &t.ID, &t.GameID, &t.Name, &t.Color, &t.Description); err != nil {
			return nil, err
		}
		out[taskID] = append(out[taskID], t)
	}
	return out, rows.Err()
}
