package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

type Category struct {
	ID     string
	GameID string
	Name   string
	Color  string
}

type CategoryRepository struct {
	db *sql.DB
}

func NewCategoryRepository(db *sql.DB) *CategoryRepository {
	return &CategoryRepository{db: db}
}

func (r *CategoryRepository) ListByGameOrderByNameAsc(ctx context.Context, gameID string) ([]Category, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, game_id, name, color FROM categories WHERE game_id = $1 ORDER BY name ASC`,
		gameID,
	)
	if err != nil {
		return nil, fmt.Errorf("list categories: %w", err)
	}
	defer func() { _ = rows.Close() }()
	var out []Category
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.GameID, &c.Name, &c.Color); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *CategoryRepository) ExistsByGameAndNameIgnoreCase(ctx context.Context, gameID, name string) (bool, error) {
	var n int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(1) FROM categories WHERE game_id = $1 AND LOWER(name) = LOWER($2)`,
		gameID, name,
	).Scan(&n)
	if err != nil {
		return false, fmt.Errorf("category exists: %w", err)
	}
	return n > 0, nil
}

func (r *CategoryRepository) FindByGameAndNameIgnoreCase(ctx context.Context, gameID, name string) (*Category, error) {
	var c Category
	err := r.db.QueryRowContext(ctx,
		`SELECT id, game_id, name, color FROM categories WHERE game_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
		gameID, name,
	).Scan(&c.ID, &c.GameID, &c.Name, &c.Color)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find category by name: %w", err)
	}
	return &c, nil
}

func (r *CategoryRepository) FindByIDAndGame(ctx context.Context, id, gameID string) (*Category, error) {
	var c Category
	err := r.db.QueryRowContext(ctx,
		`SELECT id, game_id, name, color FROM categories WHERE id = $1 AND game_id = $2`,
		id, gameID,
	).Scan(&c.ID, &c.GameID, &c.Name, &c.Color)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find category: %w", err)
	}
	return &c, nil
}

func (r *CategoryRepository) Insert(ctx context.Context, gameID, name, color string) (*Category, error) {
	id := uuid.NewString()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO categories (id, game_id, name, color) VALUES ($1, $2, $3, $4)`,
		id, gameID, name, color,
	)
	if err != nil {
		if isPGUniqueViolation(err) {
			return nil, err
		}
		return nil, fmt.Errorf("insert category: %w", err)
	}
	return &Category{ID: id, GameID: gameID, Name: name, Color: color}, nil
}

func (r *CategoryRepository) Update(ctx context.Context, c *Category) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE categories SET name = $2, color = $3 WHERE id = $1`,
		c.ID, c.Name, c.Color,
	)
	if err != nil {
		return fmt.Errorf("update category: %w", err)
	}
	return nil
}

func (r *CategoryRepository) DeleteByID(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM categories WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete category: %w", err)
	}
	return nil
}

// MapByIDs returns categories keyed by id (skips unknown ids).
func (r *CategoryRepository) MapByIDs(ctx context.Context, ids []string) (map[string]Category, error) {
	if len(ids) == 0 {
		return map[string]Category{}, nil
	}
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, game_id, name, color FROM categories WHERE id = ANY($1::text[])`,
		pq.Array(ids),
	)
	if err != nil {
		return nil, fmt.Errorf("categories by ids: %w", err)
	}
	defer func() { _ = rows.Close() }()
	out := make(map[string]Category)
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.GameID, &c.Name, &c.Color); err != nil {
			return nil, err
		}
		out[c.ID] = c
	}
	return out, rows.Err()
}

func isPGUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}
