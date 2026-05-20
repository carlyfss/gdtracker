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
	Auth0Sub sql.NullString
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

func (r *UserRepository) FindByID(ctx context.Context, id string) (*User, error) {
	var u User
	err := r.db.QueryRowContext(ctx,
		`SELECT id, username, password, auth0_sub FROM users WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.Username, &u.Password, &u.Auth0Sub)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find user by id: %w", err)
	}
	return &u, nil
}

func (r *UserRepository) FindByAuth0Sub(ctx context.Context, auth0Sub string) (*User, error) {
	var u User
	err := r.db.QueryRowContext(ctx,
		`SELECT id, username, password, auth0_sub FROM users WHERE auth0_sub = $1`,
		auth0Sub,
	).Scan(&u.ID, &u.Username, &u.Password, &u.Auth0Sub)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find user by auth0 sub: %w", err)
	}
	return &u, nil
}

func (r *UserRepository) FindByUsernameIgnoreCase(ctx context.Context, username string) (*User, error) {
	var u User
	err := r.db.QueryRowContext(ctx,
		`SELECT id, username, password, auth0_sub FROM users WHERE LOWER(username) = LOWER($1)`,
		username,
	).Scan(&u.ID, &u.Username, &u.Password, &u.Auth0Sub)
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

// InsertAuth0 creates a user provisioned from Auth0 (password column is a placeholder).
func (r *UserRepository) InsertAuth0(ctx context.Context, id, username, auth0Sub string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO users (id, username, password, auth0_sub) VALUES ($1, $2, $3, $4)`,
		id, username, "!auth0", auth0Sub,
	)
	if err != nil {
		return fmt.Errorf("insert auth0 user: %w", err)
	}
	return nil
}

func (r *UserRepository) UpdateAuth0Sub(ctx context.Context, id, auth0Sub string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE users SET auth0_sub = $2 WHERE id = $1`,
		id, auth0Sub,
	)
	if err != nil {
		return fmt.Errorf("update auth0 sub: %w", err)
	}
	return nil
}

func (r *UserRepository) ListAll(ctx context.Context) ([]User, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, username, password, auth0_sub FROM users ORDER BY username`,
	)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var out []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.Password, &u.Auth0Sub); err != nil {
			return nil, fmt.Errorf("scan user: %w", err)
		}
		out = append(out, u)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	return out, nil
}
