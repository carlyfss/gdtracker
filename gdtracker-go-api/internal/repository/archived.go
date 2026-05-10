package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type ArchivedFeatureRow struct {
	FeatureID         string
	RestoredFeatureID sql.NullString
}

type ArchivedRepository struct {
	db *sql.DB
}

func NewArchivedRepository(db *sql.DB) *ArchivedRepository {
	return &ArchivedRepository{db: db}
}

func (r *ArchivedRepository) FindArchivedFeatureByFeatureID(ctx context.Context, featureID string) (*ArchivedFeatureRow, error) {
	var row ArchivedFeatureRow
	err := r.db.QueryRowContext(ctx,
		`SELECT feature_id, restored_feature_id FROM archived_features WHERE feature_id = $1`,
		featureID,
	).Scan(&row.FeatureID, &row.RestoredFeatureID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *ArchivedRepository) UpdateRestoredFeature(ctx context.Context, archivedFeatureID, restoredID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE archived_features SET restored_feature_id = $2 WHERE feature_id = $1`,
		archivedFeatureID, restoredID,
	)
	return err
}

func (r *ArchivedRepository) ClearRestoredFeature(ctx context.Context, archivedFeatureID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE archived_features SET restored_feature_id = NULL WHERE feature_id = $1`,
		archivedFeatureID,
	)
	return err
}

func (r *ArchivedRepository) UpsertArchivedTask(ctx context.Context, taskID string, at time.Time, archivedFeatureID sql.NullString) error {
	_, err := r.db.ExecContext(ctx, `
INSERT INTO archived_tasks (task_id, archived_at, archived_feature_id)
VALUES ($1, $2, $3)
ON CONFLICT (task_id) DO UPDATE SET archived_at = EXCLUDED.archived_at, archived_feature_id = EXCLUDED.archived_feature_id`,
		taskID, at, archivedFeatureID,
	)
	return err
}

func (r *ArchivedRepository) DeleteArchivedTask(ctx context.Context, taskID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM archived_tasks WHERE task_id = $1`, taskID)
	return err
}

func (r *ArchivedRepository) InsertFeatureCopy(ctx context.Context, gameID string, parentID *string, name, description, status, color string) (string, error) {
	id := uuid.NewString()
	var p sql.NullString
	if parentID != nil && *parentID != "" {
		p = sql.NullString{String: *parentID, Valid: true}
	}
	_, err := r.db.ExecContext(ctx, `
INSERT INTO features (id, game_id, name, description, status, color, archived, archived_at, parent_feature_id)
VALUES ($1, $2, $3, $4, $5, $6, false, NULL, $7)`,
		id, gameID, name, description, status, color, p,
	)
	if err != nil {
		return "", fmt.Errorf("insert restored feature: %w", err)
	}
	return id, nil
}

func (r *ArchivedRepository) DeleteFeatureByID(ctx context.Context, featureID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM features WHERE id = $1`, featureID)
	return err
}
