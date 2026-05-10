package repository

import (
	"context"
	"database/sql"
	"fmt"
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
