package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

type GameConfigurationRepository struct {
	db *sql.DB
}

func NewGameConfigurationRepository(db *sql.DB) *GameConfigurationRepository {
	return &GameConfigurationRepository{db: db}
}

func (r *GameConfigurationRepository) GetJSONColumns(ctx context.Context, gameID string) (featureFlags, settings, exceptionTemplate []byte, err error) {
	row := r.db.QueryRowContext(ctx,
		`SELECT feature_flags, settings, exception_task_template FROM game_configurations WHERE game_id = $1`,
		gameID,
	)
	err = row.Scan(&featureFlags, &settings, &exceptionTemplate)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil, nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, nil, nil, fmt.Errorf("get game configuration: %w", err)
	}
	return featureFlags, settings, exceptionTemplate, nil
}

func (r *GameConfigurationRepository) UpdateJSONColumns(ctx context.Context, gameID string, featureFlags, settings, exceptionTemplate []byte) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE game_configurations SET feature_flags = $2::jsonb, settings = $3::jsonb, exception_task_template = $4::jsonb WHERE game_id = $1`,
		gameID, featureFlags, settings, exceptionTemplate,
	)
	if err != nil {
		return fmt.Errorf("update game configuration: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}
