package repository

import (
	"context"
	"database/sql"
	"fmt"
)

// ReserveNextExceptionTaskIndex mirrors GameExceptionTaskSequenceService.reserveNextIndexForGame.
func ReserveNextExceptionTaskIndex(ctx context.Context, db *sql.DB, gameID string) (int, error) {
	var assigned sql.NullInt64
	err := db.QueryRowContext(ctx, `
INSERT INTO game_exception_task_sequences_per_game (game_id, next_index)
VALUES ($1, 2)
ON CONFLICT (game_id) DO UPDATE
SET next_index = game_exception_task_sequences_per_game.next_index + 1
RETURNING next_index - 1`, gameID).Scan(&assigned)
	if err != nil {
		return 0, fmt.Errorf("reserve exception task index: %w", err)
	}
	if !assigned.Valid {
		return 0, fmt.Errorf("reserve exception task index: null result")
	}
	return int(assigned.Int64), nil
}
