package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

type GamePlayerRepository struct {
	db *sql.DB
}

func NewGamePlayerRepository(db *sql.DB) *GamePlayerRepository {
	return &GamePlayerRepository{db: db}
}

func (r *GamePlayerRepository) ExistsByIDAndGame(ctx context.Context, playerID, gameID string) (bool, error) {
	var n int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(1) FROM game_players WHERE id = $1 AND game_id = $2`,
		playerID, gameID,
	).Scan(&n)
	if err != nil {
		return false, fmt.Errorf("game player exists: %w", err)
	}
	return n > 0, nil
}

// Insert creates a new game_player row (ingest registration).
func (r *GamePlayerRepository) Insert(ctx context.Context, id, gameID string, createdAt time.Time) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO game_players (id, game_id, created_at) VALUES ($1, $2, $3)`,
		id, gameID, createdAt,
	)
	if err != nil {
		return fmt.Errorf("insert game player: %w", err)
	}
	return nil
}
