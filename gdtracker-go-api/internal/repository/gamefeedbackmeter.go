package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

type GameFeedbackMeterDefinitionRow struct {
	ID        string
	GameID    string
	FieldKey  string
	Question  string
	SortOrder int
}

type GameFeedbackMeterDefinitionRepository struct {
	db *sql.DB
}

func NewGameFeedbackMeterDefinitionRepository(db *sql.DB) *GameFeedbackMeterDefinitionRepository {
	return &GameFeedbackMeterDefinitionRepository{db: db}
}

func (r *GameFeedbackMeterDefinitionRepository) ListByGameOrderBySort(ctx context.Context, gameID string) ([]GameFeedbackMeterDefinitionRow, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, game_id, field_key, question, sort_order
		 FROM game_feedback_meter_definitions WHERE game_id = $1 ORDER BY sort_order ASC, field_key ASC`,
		gameID,
	)
	if err != nil {
		return nil, fmt.Errorf("list meter definitions: %w", err)
	}
	defer func() { _ = rows.Close() }()
	var out []GameFeedbackMeterDefinitionRow
	for rows.Next() {
		var m GameFeedbackMeterDefinitionRow
		if err := rows.Scan(&m.ID, &m.GameID, &m.FieldKey, &m.Question, &m.SortOrder); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *GameFeedbackMeterDefinitionRepository) FindByIDAndGame(ctx context.Context, id, gameID string) (*GameFeedbackMeterDefinitionRow, error) {
	var m GameFeedbackMeterDefinitionRow
	err := r.db.QueryRowContext(ctx,
		`SELECT id, game_id, field_key, question, sort_order
		 FROM game_feedback_meter_definitions WHERE id = $1 AND game_id = $2`,
		id, gameID,
	).Scan(&m.ID, &m.GameID, &m.FieldKey, &m.Question, &m.SortOrder)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find meter definition: %w", err)
	}
	return &m, nil
}

func (r *GameFeedbackMeterDefinitionRepository) FindByGameAndFieldKeyIgnoreCase(ctx context.Context, gameID, fieldKey string) (*GameFeedbackMeterDefinitionRow, error) {
	var m GameFeedbackMeterDefinitionRow
	err := r.db.QueryRowContext(ctx,
		`SELECT id, game_id, field_key, question, sort_order
		 FROM game_feedback_meter_definitions WHERE game_id = $1 AND LOWER(field_key) = LOWER($2)`,
		gameID, fieldKey,
	).Scan(&m.ID, &m.GameID, &m.FieldKey, &m.Question, &m.SortOrder)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find meter by key: %w", err)
	}
	return &m, nil
}

func (r *GameFeedbackMeterDefinitionRepository) ExistsByGameAndFieldKeyIgnoreCase(ctx context.Context, gameID, fieldKey string) (bool, error) {
	var n int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(1) FROM game_feedback_meter_definitions WHERE game_id = $1 AND LOWER(field_key) = LOWER($2)`,
		gameID, fieldKey,
	).Scan(&n)
	if err != nil {
		return false, fmt.Errorf("exists meter key: %w", err)
	}
	return n > 0, nil
}

func (r *GameFeedbackMeterDefinitionRepository) Insert(ctx context.Context, id, gameID, fieldKey, question string, sortOrder int) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO game_feedback_meter_definitions (id, game_id, field_key, question, sort_order)
		 VALUES ($1, $2, $3, $4, $5)`,
		id, gameID, fieldKey, question, sortOrder,
	)
	if err != nil {
		return fmt.Errorf("insert meter definition: %w", err)
	}
	return nil
}

func (r *GameFeedbackMeterDefinitionRepository) Update(ctx context.Context, id, gameID, fieldKey, question string, sortOrder int) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE game_feedback_meter_definitions SET field_key = $3, question = $4, sort_order = $5
		 WHERE id = $1 AND game_id = $2`,
		id, gameID, fieldKey, question, sortOrder,
	)
	if err != nil {
		return fmt.Errorf("update meter definition: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *GameFeedbackMeterDefinitionRepository) Delete(ctx context.Context, id, gameID string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM game_feedback_meter_definitions WHERE id = $1 AND game_id = $2`,
		id, gameID,
	)
	if err != nil {
		return fmt.Errorf("delete meter definition: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}
