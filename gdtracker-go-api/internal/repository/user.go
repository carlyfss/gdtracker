package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

// User row mirrors gdtracker-api users table.
type User struct {
	ID       string
	Username string
	Password string
}

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) ExistsByUsernameIgnoreCase(ctx context.Context, username string) (bool, error) {
	var n int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(1) FROM users WHERE LOWER(username) = LOWER($1)`,
		username,
	).Scan(&n)
	if err != nil {
		return false, fmt.Errorf("exists user: %w", err)
	}
	return n > 0, nil
}

func (r *UserRepository) FindByUsernameIgnoreCase(ctx context.Context, username string) (*User, error) {
	var u User
	err := r.db.QueryRowContext(ctx,
		`SELECT id, username, password FROM users WHERE LOWER(username) = LOWER($1)`,
		username,
	).Scan(&u.ID, &u.Username, &u.Password)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find user: %w", err)
	}
	return &u, nil
}

func (r *UserRepository) Insert(ctx context.Context, id, username, password string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO users (id, username, password) VALUES ($1, $2, $3)`,
		id, username, password,
	)
	if err != nil {
		return fmt.Errorf("insert user: %w", err)
	}
	return nil
}
