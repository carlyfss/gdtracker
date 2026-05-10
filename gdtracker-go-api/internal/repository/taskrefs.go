package repository

import (
	"context"
	"database/sql"
	"fmt"
)

// TaskRefsRepository holds small existence queries shared by controllers.
type TaskRefsRepository struct {
	db *sql.DB
}

func NewTaskRefsRepository(db *sql.DB) *TaskRefsRepository {
	return &TaskRefsRepository{db: db}
}

func (r *TaskRefsRepository) ExistsByCategoryID(ctx context.Context, categoryID string) (bool, error) {
	var n int
	err := r.db.QueryRowContext(ctx, `SELECT COUNT(1) FROM tasks WHERE category_id = $1`, categoryID).Scan(&n)
	if err != nil {
		return false, fmt.Errorf("tasks by category: %w", err)
	}
	return n > 0, nil
}
