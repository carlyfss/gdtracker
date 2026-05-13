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

const (
	PlanningKindFolder     = "folder"
	PlanningKindMarkdown   = "markdown"
	PlanningKindExcalidraw = "excalidraw"
)

// PlanningNodeMeta is returned by list (no large payloads).
type PlanningNodeMeta struct {
	ID        string
	ParentID  sql.NullString
	Kind      string
	Name      string
	SortOrder int
	UpdatedAt time.Time
	CreatedAt time.Time
}

// PlanningNodeDetail is a full row for get-by-id.
type PlanningNodeDetail struct {
	PlanningNodeMeta
	MarkdownBody    sql.NullString
	ExcalidrawScene sql.NullString // JSON text when present
}

type PlanningRepository struct {
	db *sql.DB
}

func NewPlanningRepository(db *sql.DB) *PlanningRepository {
	return &PlanningRepository{db: db}
}

func (r *PlanningRepository) ListMetaByGame(ctx context.Context, gameID string) ([]PlanningNodeMeta, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, parent_id, kind, name, sort_order, updated_at, created_at
		 FROM planning_nodes WHERE game_id = $1
		 ORDER BY sort_order ASC, LOWER(name) ASC`,
		gameID,
	)
	if err != nil {
		return nil, fmt.Errorf("list planning nodes: %w", err)
	}
	defer func() { _ = rows.Close() }()
	var out []PlanningNodeMeta
	for rows.Next() {
		var m PlanningNodeMeta
		if err := rows.Scan(&m.ID, &m.ParentID, &m.Kind, &m.Name, &m.SortOrder, &m.UpdatedAt, &m.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *PlanningRepository) FindByIDAndGame(ctx context.Context, id, gameID string) (*PlanningNodeDetail, error) {
	var d PlanningNodeDetail
	err := r.db.QueryRowContext(ctx,
		`SELECT id, parent_id, kind, name, sort_order, updated_at, created_at,
		        markdown_body, excalidraw_scene::text
		 FROM planning_nodes WHERE id = $1 AND game_id = $2`,
		id, gameID,
	).Scan(
		&d.ID, &d.ParentID, &d.Kind, &d.Name, &d.SortOrder, &d.UpdatedAt, &d.CreatedAt,
		&d.MarkdownBody, &d.ExcalidrawScene,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find planning node: %w", err)
	}
	return &d, nil
}

// FindKindByIDAndGame returns kind only (lightweight parent validation).
func (r *PlanningRepository) FindKindByIDAndGame(ctx context.Context, id, gameID string) (kind string, ok bool, err error) {
	err = r.db.QueryRowContext(ctx,
		`SELECT kind FROM planning_nodes WHERE id = $1 AND game_id = $2`,
		id, gameID,
	).Scan(&kind)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("find planning kind: %w", err)
	}
	return kind, true, nil
}

// IsAncestorOf walks parent chain from nodeID upward; returns true if ancestorID appears (ancestorID is strict ancestor of nodeID).
func (r *PlanningRepository) IsAncestorOf(ctx context.Context, gameID, ancestorID, nodeID string) (bool, error) {
	if ancestorID == nodeID {
		return false, nil
	}
	var found bool
	err := r.db.QueryRowContext(ctx,
		`WITH RECURSIVE walk AS (
			SELECT id, parent_id FROM planning_nodes WHERE id = $2 AND game_id = $3
			UNION ALL
			SELECT n.id, n.parent_id FROM planning_nodes n INNER JOIN walk w ON n.id = w.parent_id
		)
		SELECT EXISTS(SELECT 1 FROM walk WHERE id = $1)`,
		ancestorID, nodeID, gameID,
	).Scan(&found)
	if err != nil {
		return false, fmt.Errorf("is ancestor: %w", err)
	}
	return found, nil
}

func (r *PlanningRepository) NextSortOrder(ctx context.Context, gameID string, parentID sql.NullString) (int, error) {
	var next sql.NullInt64
	err := r.db.QueryRowContext(ctx,
		`SELECT COALESCE(MAX(sort_order), -1) + 1 FROM planning_nodes
		 WHERE game_id = $1 AND parent_id IS NOT DISTINCT FROM $2`,
		gameID, parentID,
	).Scan(&next)
	if err != nil {
		return 0, fmt.Errorf("next sort order: %w", err)
	}
	if !next.Valid {
		return 0, nil
	}
	return int(next.Int64), nil
}

type PlanningInsert struct {
	GameID          string
	ParentID        sql.NullString
	Kind            string
	Name            string
	SortOrder       int
	MarkdownBody    sql.NullString
	ExcalidrawScene []byte // nil or JSON
}

func (r *PlanningRepository) Insert(ctx context.Context, in PlanningInsert) (*PlanningNodeDetail, error) {
	id := uuid.NewString()
	now := time.Now().UTC()
	var exc interface{}
	if len(in.ExcalidrawScene) > 0 {
		exc = in.ExcalidrawScene
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO planning_nodes (id, game_id, parent_id, kind, name, sort_order, markdown_body, excalidraw_scene, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)`,
		id, in.GameID, in.ParentID, in.Kind, in.Name, in.SortOrder, in.MarkdownBody, exc, now, now,
	)
	if err != nil {
		if isPGUniqueViolation(err) {
			return nil, err
		}
		return nil, fmt.Errorf("insert planning node: %w", err)
	}
	return r.FindByIDAndGame(ctx, id, in.GameID)
}

type PlanningUpdate struct {
	Name            *string
	ParentID        *sql.NullString // nil = omit; Valid false = set NULL parent
	SortOrder       *int
	MarkdownBody    *string // empty string clears
	ExcalidrawScene *[]byte // nil omit; empty slice could mean clear - use pointer to []byte
}

func (r *PlanningRepository) Update(ctx context.Context, gameID, id string, u PlanningUpdate) error {
	parts := []string{"updated_at = $1"}
	args := []any{time.Now().UTC()}
	n := 2

	if u.Name != nil {
		parts = append(parts, fmt.Sprintf("name = $%d", n))
		args = append(args, *u.Name)
		n++
	}
	if u.ParentID != nil {
		parts = append(parts, fmt.Sprintf("parent_id = $%d", n))
		args = append(args, *u.ParentID)
		n++
	}
	if u.SortOrder != nil {
		parts = append(parts, fmt.Sprintf("sort_order = $%d", n))
		args = append(args, *u.SortOrder)
		n++
	}
	if u.MarkdownBody != nil {
		parts = append(parts, fmt.Sprintf("markdown_body = $%d", n))
		args = append(args, *u.MarkdownBody)
		n++
	}
	if u.ExcalidrawScene != nil {
		parts = append(parts, fmt.Sprintf("excalidraw_scene = $%d::jsonb", n))
		if len(*u.ExcalidrawScene) == 0 {
			args = append(args, nil)
		} else {
			args = append(args, *u.ExcalidrawScene)
		}
		n++
	}

	if len(parts) == 1 {
		return nil
	}

	q := "UPDATE planning_nodes SET " + strings.Join(parts, ", ") + fmt.Sprintf(" WHERE id = $%d AND game_id = $%d", n, n+1)
	args = append(args, id, gameID)

	res, err := r.db.ExecContext(ctx, q, args...)
	if err != nil {
		if isPGUniqueViolation(err) {
			return err
		}
		return fmt.Errorf("update planning node: %w", err)
	}
	aff, _ := res.RowsAffected()
	if aff == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *PlanningRepository) Delete(ctx context.Context, gameID, id string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM planning_nodes WHERE id = $1 AND game_id = $2`,
		id, gameID,
	)
	if err != nil {
		return fmt.Errorf("delete planning node: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func PlanningUniqueViolation(err error) bool {
	return isPGUniqueViolation(err)
}

func PlanningForeignKeyViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23503"
}
