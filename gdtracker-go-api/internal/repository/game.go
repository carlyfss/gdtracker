package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

const DefaultExceptionCategoryName = "Game exceptions"

// GameSummary is returned by list/create game APIs.
type GameSummary struct {
	ID   string
	Name string
}

// GameRow includes ingest fields for token routes.
type GameRow struct {
	ID                   string
	Name                 string
	OwnerID              string
	IngestTokenHash      sql.NullString
	IngestTokenCreatedAt sql.NullTime
	LastIntegrationValAt sql.NullTime
}

type GameRepository struct {
	db *sql.DB
}

func NewGameRepository(db *sql.DB) *GameRepository {
	return &GameRepository{db: db}
}

func (r *GameRepository) ListByOwnerOrderByNameAsc(ctx context.Context, ownerID string) ([]GameSummary, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, name FROM games WHERE user_id = $1 ORDER BY name ASC`,
		ownerID,
	)
	if err != nil {
		return nil, fmt.Errorf("list games: %w", err)
	}
	defer func() { _ = rows.Close() }()
	var out []GameSummary
	for rows.Next() {
		var g GameSummary
		if err := rows.Scan(&g.ID, &g.Name); err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

func (r *GameRepository) FindByIDAndOwner(ctx context.Context, gameID, ownerID string) (*GameRow, error) {
	var g GameRow
	err := r.db.QueryRowContext(ctx,
		`SELECT id, name, user_id, ingest_token_hash, ingest_token_created_at, last_integration_validation_at
		 FROM games WHERE id = $1 AND user_id = $2`,
		gameID, ownerID,
	).Scan(&g.ID, &g.Name, &g.OwnerID, &g.IngestTokenHash, &g.IngestTokenCreatedAt, &g.LastIntegrationValAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find game owned: %w", err)
	}
	return &g, nil
}

func (r *GameRepository) FindByID(ctx context.Context, gameID string) (*GameRow, error) {
	var g GameRow
	err := r.db.QueryRowContext(ctx,
		`SELECT id, name, user_id, ingest_token_hash, ingest_token_created_at, last_integration_validation_at
		 FROM games WHERE id = $1`,
		gameID,
	).Scan(&g.ID, &g.Name, &g.OwnerID, &g.IngestTokenHash, &g.IngestTokenCreatedAt, &g.LastIntegrationValAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find game: %w", err)
	}
	return &g, nil
}

func (r *GameRepository) Insert(ctx context.Context, name, ownerID string) (string, error) {
	id := uuid.NewString()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO games (id, name, user_id) VALUES ($1, $2, $3)`,
		id, name, ownerID,
	)
	if err != nil {
		return "", fmt.Errorf("insert game: %w", err)
	}
	return id, nil
}

func (r *GameRepository) SetIngestToken(ctx context.Context, gameID, hash string, created time.Time) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE games SET ingest_token_hash = $2, ingest_token_created_at = $3 WHERE id = $1`,
		gameID, hash, created,
	)
	if err != nil {
		return fmt.Errorf("set ingest token: %w", err)
	}
	return nil
}

// EnsureGameBootstrap mirrors GameSetupService.ensureGameBootstrap (idempotent).
func EnsureGameBootstrap(ctx context.Context, db *sql.DB, gameID string) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var n int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(1) FROM game_configurations WHERE game_id = $1`, gameID).Scan(&n); err != nil {
		return fmt.Errorf("game_configurations exists: %w", err)
	}
	if n > 0 {
		return tx.Commit()
	}

	var catID string
	err = tx.QueryRowContext(ctx,
		`SELECT id FROM categories WHERE game_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
		gameID, DefaultExceptionCategoryName,
	).Scan(&catID)
	if errors.Is(err, sql.ErrNoRows) {
		catID = uuid.NewString()
		_, err = tx.ExecContext(ctx,
			`INSERT INTO categories (id, game_id, name, color) VALUES ($1, $2, $3, $4)`,
			catID, gameID, DefaultExceptionCategoryName, "#818cf8",
		)
		if err != nil {
			return fmt.Errorf("insert default category: %w", err)
		}
	} else if err != nil {
		return fmt.Errorf("lookup default category: %w", err)
	}

	cfgID := uuid.NewString()
	tplObj := map[string]any{
		"titleTemplate":       "Fix Exception #<EXCEPTION_INDEX>",
		"descriptionTemplate": "```\n<EXCEPTION_TRACE>\n```",
		"defaultCategoryId":   catID,
	}
	tplBytes, jerr := json.Marshal(tplObj)
	if jerr != nil {
		return fmt.Errorf("exception_task_template json: %w", jerr)
	}
	_, err = tx.ExecContext(ctx,
		`INSERT INTO game_configurations (id, game_id, feature_flags, settings, exception_task_template)
		 VALUES ($1, $2, '{}'::jsonb, '{}'::jsonb, $3::jsonb)`,
		cfgID, gameID, string(tplBytes),
	)
	if err != nil {
		return fmt.Errorf("insert game_configuration: %w", err)
	}
	return tx.Commit()
}
