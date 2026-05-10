package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

type Tag struct {
	ID          string
	GameID      string
	Name        string
	Color       string
	Description sql.NullString
}

type TagRepository struct {
	db *sql.DB
}

func NewTagRepository(db *sql.DB) *TagRepository {
	return &TagRepository{db: db}
}

func (r *TagRepository) ListByGameOrderByNameAsc(ctx context.Context, gameID string) ([]Tag, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, game_id, name, color, description FROM tags WHERE game_id = $1 ORDER BY name ASC`,
		gameID,
	)
	if err != nil {
		return nil, fmt.Errorf("list tags: %w", err)
	}
	defer func() { _ = rows.Close() }()
	var out []Tag
	for rows.Next() {
		var t Tag
		if err := rows.Scan(&t.ID, &t.GameID, &t.Name, &t.Color, &t.Description); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *TagRepository) ExistsByGameAndNameIgnoreCase(ctx context.Context, gameID, name string) (bool, error) {
	var n int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(1) FROM tags WHERE game_id = $1 AND LOWER(name) = LOWER($2)`,
		gameID, name,
	).Scan(&n)
	if err != nil {
		return false, fmt.Errorf("tag exists: %w", err)
	}
	return n > 0, nil
}

func (r *TagRepository) FindByGameAndNameIgnoreCase(ctx context.Context, gameID, name string) (*Tag, error) {
	var t Tag
	err := r.db.QueryRowContext(ctx,
		`SELECT id, game_id, name, color, description FROM tags WHERE game_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
		gameID, name,
	).Scan(&t.ID, &t.GameID, &t.Name, &t.Color, &t.Description)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find tag by name: %w", err)
	}
	return &t, nil
}

func (r *TagRepository) FindByIDAndGame(ctx context.Context, id, gameID string) (*Tag, error) {
	var t Tag
	err := r.db.QueryRowContext(ctx,
		`SELECT id, game_id, name, color, description FROM tags WHERE id = $1 AND game_id = $2`,
		id, gameID,
	).Scan(&t.ID, &t.GameID, &t.Name, &t.Color, &t.Description)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find tag: %w", err)
	}
	return &t, nil
}

func (r *TagRepository) FindAllByIDsInGame(ctx context.Context, gameID string, ids []string) ([]Tag, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, game_id, name, color, description FROM tags WHERE game_id = $1 AND id = ANY($2)`,
		gameID, pq.Array(ids),
	)
	if err != nil {
		return nil, fmt.Errorf("find tags by ids: %w", err)
	}
	defer func() { _ = rows.Close() }()
	var out []Tag
	for rows.Next() {
		var t Tag
		if err := rows.Scan(&t.ID, &t.GameID, &t.Name, &t.Color, &t.Description); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *TagRepository) Insert(ctx context.Context, gameID, name, color string, description *string) (*Tag, error) {
	id := uuid.NewString()
	var desc sql.NullString
	if description != nil && *description != "" {
		desc = sql.NullString{String: *description, Valid: true}
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO tags (id, game_id, name, color, description) VALUES ($1, $2, $3, $4, $5)`,
		id, gameID, name, color, desc,
	)
	if err != nil {
		if isPGUniqueViolation(err) {
			return nil, err
		}
		return nil, fmt.Errorf("insert tag: %w", err)
	}
	return &Tag{ID: id, GameID: gameID, Name: name, Color: color, Description: desc}, nil
}

func (r *TagRepository) Update(ctx context.Context, t *Tag) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE tags SET name = $2, color = $3, description = $4 WHERE id = $1`,
		t.ID, t.Name, t.Color, t.Description,
	)
	if err != nil {
		return fmt.Errorf("update tag: %w", err)
	}
	return nil
}

func (r *TagRepository) DeleteByID(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM tags WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete tag: %w", err)
	}
	return nil
}
