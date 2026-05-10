package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

// Feature mirrors fields needed for task JSON and validation.
type Feature struct {
	ID            string
	GameID        string
	Name          string
	Description   sql.NullString
	Status        string
	Color         string
	Archived      bool
	ArchivedAt    sql.NullTime
	ParentFeature sql.NullString
}

type FeatureRepository struct {
	db *sql.DB
}

func NewFeatureRepository(db *sql.DB) *FeatureRepository {
	return &FeatureRepository{db: db}
}

func (r *FeatureRepository) FindByIDAndGame(ctx context.Context, id, gameID string) (*Feature, error) {
	var f Feature
	err := r.db.QueryRowContext(ctx,
		`SELECT id, game_id, name, description, status, color, archived, archived_at, parent_feature_id
		 FROM features WHERE id = $1 AND game_id = $2`,
		id, gameID,
	).Scan(&f.ID, &f.GameID, &f.Name, &f.Description, &f.Status, &f.Color, &f.Archived, &f.ArchivedAt, &f.ParentFeature)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find feature: %w", err)
	}
	return &f, nil
}

func (r *FeatureRepository) FindNameInGameParent(ctx context.Context, gameID string, parentID *string, name string) (bool, error) {
	var n int
	var err error
	if parentID == nil || *parentID == "" {
		err = r.db.QueryRowContext(ctx,
			`SELECT COUNT(1) FROM features WHERE game_id = $1 AND parent_feature_id IS NULL AND LOWER(name) = LOWER($2)`,
			gameID, name,
		).Scan(&n)
	} else {
		err = r.db.QueryRowContext(ctx,
			`SELECT COUNT(1) FROM features WHERE game_id = $1 AND parent_feature_id = $2 AND LOWER(name) = LOWER($3)`,
			gameID, *parentID, name,
		).Scan(&n)
	}
	if err != nil {
		return false, fmt.Errorf("feature name conflict: %w", err)
	}
	return n > 0, nil
}
