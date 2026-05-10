package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
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

// ListByGameArchivedOrderByNameAsc matches Spring findByGameIdAndArchivedOrderByNameAsc (archivedAt null vs non-null).
func (r *FeatureRepository) ListByGameArchivedOrderByNameAsc(ctx context.Context, gameID string, archivedOnly bool) ([]Feature, error) {
	var q string
	if archivedOnly {
		q = `SELECT id, game_id, name, description, status, color, archived, archived_at, parent_feature_id
			FROM features WHERE game_id = $1 AND archived_at IS NOT NULL ORDER BY name ASC`
	} else {
		q = `SELECT id, game_id, name, description, status, color, archived, archived_at, parent_feature_id
			FROM features WHERE game_id = $1 AND archived_at IS NULL ORDER BY name ASC`
	}
	rows, err := r.db.QueryContext(ctx, q, gameID)
	if err != nil {
		return nil, fmt.Errorf("list features: %w", err)
	}
	defer func() { _ = rows.Close() }()
	return scanFeatures(rows)
}

// ListAllByGameOrderByNameAsc returns every feature in the game (for subtree collection).
func (r *FeatureRepository) ListAllByGameOrderByNameAsc(ctx context.Context, gameID string) ([]Feature, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, game_id, name, description, status, color, archived, archived_at, parent_feature_id
			FROM features WHERE game_id = $1 ORDER BY name ASC`,
		gameID,
	)
	if err != nil {
		return nil, fmt.Errorf("list all features: %w", err)
	}
	defer func() { _ = rows.Close() }()
	return scanFeatures(rows)
}

func scanFeatures(rows *sql.Rows) ([]Feature, error) {
	var out []Feature
	for rows.Next() {
		var f Feature
		if err := rows.Scan(&f.ID, &f.GameID, &f.Name, &f.Description, &f.Status, &f.Color, &f.Archived, &f.ArchivedAt, &f.ParentFeature); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

type FeatureInsert struct {
	ID          string
	GameID      string
	Name        string
	Description sql.NullString
	Status      string
	Color       string
	ParentID    *string
}

func (r *FeatureRepository) Insert(ctx context.Context, ins FeatureInsert) error {
	id := ins.ID
	if id == "" {
		id = uuid.NewString()
	}
	var p sql.NullString
	if ins.ParentID != nil && *ins.ParentID != "" {
		p = sql.NullString{String: *ins.ParentID, Valid: true}
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO features (id, game_id, name, description, status, color, archived, archived_at, parent_feature_id)
		 VALUES ($1,$2,$3,$4,$5,$6,false,NULL,$7)`,
		id, ins.GameID, ins.Name, ins.Description, ins.Status, ins.Color, p,
	)
	if err != nil {
		return fmt.Errorf("insert feature: %w", err)
	}
	return nil
}

type FeatureUpdate struct {
	ID          string
	GameID      string
	Name        string
	Description sql.NullString
	Status      string
	Color       string
	ParentID    *string
}

func (r *FeatureRepository) Update(ctx context.Context, u FeatureUpdate) error {
	var p sql.NullString
	if u.ParentID != nil && *u.ParentID != "" {
		p = sql.NullString{String: *u.ParentID, Valid: true}
	}
	res, err := r.db.ExecContext(ctx,
		`UPDATE features SET name=$3, description=$4, status=$5, color=$6, parent_feature_id=$7
		 WHERE id=$1 AND game_id=$2`,
		u.ID, u.GameID, u.Name, u.Description, u.Status, u.Color, p,
	)
	if err != nil {
		return fmt.Errorf("update feature: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *FeatureRepository) DeleteByIDAndGame(ctx context.Context, id, gameID string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM features WHERE id = $1 AND game_id = $2`, id, gameID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *FeatureRepository) ExistsChildWithParentID(ctx context.Context, parentFeatureID string) (bool, error) {
	var n int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(1) FROM features WHERE parent_feature_id = $1`,
		parentFeatureID,
	).Scan(&n)
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

func (r *FeatureRepository) ExistsTaskForFeatureID(ctx context.Context, featureID string) (bool, error) {
	var n int
	err := r.db.QueryRowContext(ctx, `SELECT COUNT(1) FROM tasks WHERE feature_id = $1`, featureID).Scan(&n)
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

// ExistsOtherNameInParent returns true if another feature (not excludeID) has the same name under the same parent.
func (r *FeatureRepository) ExistsOtherNameInParent(ctx context.Context, gameID string, parentID *string, name, excludeID string) (bool, error) {
	var q string
	var args []interface{}
	if parentID == nil || *parentID == "" {
		q = `SELECT COUNT(1) FROM features WHERE game_id = $1 AND parent_feature_id IS NULL
			AND LOWER(name) = LOWER($2) AND id <> $3`
		args = []interface{}{gameID, name, excludeID}
	} else {
		q = `SELECT COUNT(1) FROM features WHERE game_id = $1 AND parent_feature_id = $2
			AND LOWER(name) = LOWER($3) AND id <> $4`
		args = []interface{}{gameID, *parentID, name, excludeID}
	}
	var n int
	if err := r.db.QueryRowContext(ctx, q, args...).Scan(&n); err != nil {
		return false, err
	}
	return n > 0, nil
}

// LockFeatureForUpdate locks a feature row for the duration of the transaction.
// SetArchivedStateTx sets feature archived flag and timestamp (or clears when archive is false).
func (r *FeatureRepository) SetArchivedStateTx(ctx context.Context, tx *sql.Tx, featureID string, at time.Time, archive bool) error {
	if archive {
		_, err := tx.ExecContext(ctx,
			`UPDATE features SET archived = true, archived_at = $2 WHERE id = $1`,
			featureID, at,
		)
		return err
	}
	_, err := tx.ExecContext(ctx,
		`UPDATE features SET archived = false, archived_at = NULL WHERE id = $1`,
		featureID,
	)
	return err
}

func LockFeatureForUpdate(ctx context.Context, tx *sql.Tx, featureID, gameID string) error {
	var id string
	err := tx.QueryRowContext(ctx,
		`SELECT id FROM features WHERE id = $1 AND game_id = $2 FOR UPDATE`,
		featureID, gameID,
	).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return sql.ErrNoRows
	}
	return err
}

// DeleteArchivedByGameBeforeCutoff deletes features that are archived and older than cutoff (Spring FeatureRepository parity).
func (r *FeatureRepository) DeleteArchivedByGameBeforeCutoff(ctx context.Context, gameID string, cutoff time.Time) (int64, error) {
	res, err := r.db.ExecContext(ctx, `
DELETE FROM features
WHERE game_id = $1
  AND archived_at IS NOT NULL
  AND archived_at < $2`,
		gameID, cutoff,
	)
	if err != nil {
		return 0, fmt.Errorf("delete archived features before cutoff: %w", err)
	}
	return res.RowsAffected()
}

// CollectFeatureSubtreeIDs returns rootId and all descendant feature ids (BFS), given all features in the game.
func CollectFeatureSubtreeIDs(all []Feature, rootID string) []string {
	childrenByParent := make(map[string][]string)
	for _, f := range all {
		var pk string
		if f.ParentFeature.Valid {
			pk = f.ParentFeature.String
		}
		childrenByParent[pk] = append(childrenByParent[pk], f.ID)
	}
	var out []string
	seen := make(map[string]struct{})
	queue := []string{rootID}
	for len(queue) > 0 {
		id := queue[0]
		queue = queue[1:]
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
		for _, ch := range childrenByParent[id] {
			queue = append(queue, ch)
		}
	}
	return out
}
