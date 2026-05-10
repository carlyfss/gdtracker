package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

type GameFeedbackRow struct {
	ID           string
	GameID       string
	GamePlayerID string
	Title        string
	Description  string
	Meters       map[string]int
	CreatedAt    time.Time
}

type GameFeedbackRepository struct {
	db *sql.DB
}

func NewGameFeedbackRepository(db *sql.DB) *GameFeedbackRepository {
	return &GameFeedbackRepository{db: db}
}

func (r *GameFeedbackRepository) ListByGameOrderByCreatedDesc(ctx context.Context, gameID string) ([]GameFeedbackRow, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, game_id, game_player_id, title, description, meters, created_at
		 FROM game_feedback WHERE game_id = $1 ORDER BY created_at DESC`,
		gameID,
	)
	if err != nil {
		return nil, fmt.Errorf("list feedback: %w", err)
	}
	defer func() { _ = rows.Close() }()
	return scanFeedbackRows(rows)
}

func scanFeedbackRows(rows *sql.Rows) ([]GameFeedbackRow, error) {
	var out []GameFeedbackRow
	for rows.Next() {
		var fb GameFeedbackRow
		var raw []byte
		if err := rows.Scan(&fb.ID, &fb.GameID, &fb.GamePlayerID, &fb.Title, &fb.Description, &raw, &fb.CreatedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(raw, &fb.Meters); err != nil {
			return nil, err
		}
		out = append(out, fb)
	}
	return out, rows.Err()
}

func (r *GameFeedbackRepository) FindByIDAndGame(ctx context.Context, id, gameID string) (*GameFeedbackRow, error) {
	var fb GameFeedbackRow
	var raw []byte
	err := r.db.QueryRowContext(ctx,
		`SELECT id, game_id, game_player_id, title, description, meters, created_at
		 FROM game_feedback WHERE id = $1 AND game_id = $2`,
		id, gameID,
	).Scan(&fb.ID, &fb.GameID, &fb.GamePlayerID, &fb.Title, &fb.Description, &raw, &fb.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find feedback: %w", err)
	}
	if err := json.Unmarshal(raw, &fb.Meters); err != nil {
		return nil, fmt.Errorf("meters json: %w", err)
	}
	return &fb, nil
}

func (r *GameFeedbackRepository) Insert(ctx context.Context, id, gameID, playerID, title, description string, meters map[string]int, createdAt time.Time) error {
	if meters == nil {
		meters = map[string]int{}
	}
	raw, err := json.Marshal(meters)
	if err != nil {
		return fmt.Errorf("meters marshal: %w", err)
	}
	_, err = r.db.ExecContext(ctx,
		`INSERT INTO game_feedback (id, game_id, game_player_id, title, description, meters, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
		id, gameID, playerID, title, description, string(raw), createdAt,
	)
	if err != nil {
		return fmt.Errorf("insert feedback: %w", err)
	}
	return nil
}
