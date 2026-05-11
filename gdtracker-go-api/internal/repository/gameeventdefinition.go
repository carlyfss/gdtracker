package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
)

// GameEventDefinitionRow maps game_event_definitions.
type GameEventDefinitionRow struct {
	ID                       string
	GameID                   string
	Code                     string
	DisplayName              sql.NullString
	MessageTemplate          string
	ImageData                sql.NullString
	Color                    string
	ExamplePlaceholderValues map[string]string
}

func decodeExamplePlaceholderJSON(raw []byte) (map[string]string, error) {
	if len(raw) == 0 {
		return map[string]string{}, nil
	}
	var m map[string]string
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, err
	}
	if m == nil {
		return map[string]string{}, nil
	}
	return m, nil
}

func marshalExamplePlaceholderJSON(m map[string]string) ([]byte, error) {
	if len(m) == 0 {
		return []byte("{}"), nil
	}
	return json.Marshal(m)
}

type GameEventDefinitionRepository struct {
	db *sql.DB
}

func NewGameEventDefinitionRepository(db *sql.DB) *GameEventDefinitionRepository {
	return &GameEventDefinitionRepository{db: db}
}

func (r *GameEventDefinitionRepository) ListByGameOrderByCodeAsc(ctx context.Context, gameID string) ([]GameEventDefinitionRow, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, game_id, code, display_name, message_template, image_data, color, example_placeholder_values
		 FROM game_event_definitions WHERE game_id = $1 ORDER BY code ASC`,
		gameID,
	)
	if err != nil {
		return nil, fmt.Errorf("list event definitions: %w", err)
	}
	defer func() { _ = rows.Close() }()
	return scanEventDefinitionRows(rows)
}

func scanEventDefinitionRows(rows *sql.Rows) ([]GameEventDefinitionRow, error) {
	var out []GameEventDefinitionRow
	for rows.Next() {
		var d GameEventDefinitionRow
		var rawEx []byte
		if err := rows.Scan(&d.ID, &d.GameID, &d.Code, &d.DisplayName, &d.MessageTemplate, &d.ImageData, &d.Color, &rawEx); err != nil {
			return nil, err
		}
		ex, err := decodeExamplePlaceholderJSON(rawEx)
		if err != nil {
			return nil, err
		}
		d.ExamplePlaceholderValues = ex
		out = append(out, d)
	}
	return out, rows.Err()
}

func (r *GameEventDefinitionRepository) FindByIDAndGame(ctx context.Context, id, gameID string) (*GameEventDefinitionRow, error) {
	var d GameEventDefinitionRow
	var rawEx []byte
	err := r.db.QueryRowContext(ctx,
		`SELECT id, game_id, code, display_name, message_template, image_data, color, example_placeholder_values
		 FROM game_event_definitions WHERE id = $1 AND game_id = $2`,
		id, gameID,
	).Scan(&d.ID, &d.GameID, &d.Code, &d.DisplayName, &d.MessageTemplate, &d.ImageData, &d.Color, &rawEx)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find event definition: %w", err)
	}
	ex, err := decodeExamplePlaceholderJSON(rawEx)
	if err != nil {
		return nil, fmt.Errorf("decode example placeholders: %w", err)
	}
	d.ExamplePlaceholderValues = ex
	return &d, nil
}

func (r *GameEventDefinitionRepository) FindByGameAndCodeIgnoreCase(ctx context.Context, gameID, code string) (*GameEventDefinitionRow, error) {
	var d GameEventDefinitionRow
	var rawEx []byte
	err := r.db.QueryRowContext(ctx,
		`SELECT id, game_id, code, display_name, message_template, image_data, color, example_placeholder_values
		 FROM game_event_definitions WHERE game_id = $1 AND LOWER(code) = LOWER($2)`,
		gameID, code,
	).Scan(&d.ID, &d.GameID, &d.Code, &d.DisplayName, &d.MessageTemplate, &d.ImageData, &d.Color, &rawEx)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find event definition by code: %w", err)
	}
	ex, err := decodeExamplePlaceholderJSON(rawEx)
	if err != nil {
		return nil, fmt.Errorf("decode example placeholders: %w", err)
	}
	d.ExamplePlaceholderValues = ex
	return &d, nil
}

func (r *GameEventDefinitionRepository) ExistsByGameAndCodeIgnoreCase(ctx context.Context, gameID, code string) (bool, error) {
	var n int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(1) FROM game_event_definitions WHERE game_id = $1 AND LOWER(code) = LOWER($2)`,
		gameID, code,
	).Scan(&n)
	if err != nil {
		return false, fmt.Errorf("exists event definition code: %w", err)
	}
	return n > 0, nil
}

func (r *GameEventDefinitionRepository) Insert(ctx context.Context, id, gameID, code string, displayName sql.NullString, messageTemplate string, imageData sql.NullString, color string, examplePlaceholderValues map[string]string) error {
	var disp any
	if displayName.Valid {
		disp = displayName.String
	} else {
		disp = nil
	}
	exJSON, err := marshalExamplePlaceholderJSON(examplePlaceholderValues)
	if err != nil {
		return fmt.Errorf("marshal example placeholders: %w", err)
	}
	_, err = r.db.ExecContext(ctx,
		`INSERT INTO game_event_definitions (id, game_id, code, display_name, message_template, image_data, color, example_placeholder_values)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
		id, gameID, code, disp, messageTemplate, imageData, color, exJSON,
	)
	if err != nil {
		return fmt.Errorf("insert event definition: %w", err)
	}
	return nil
}

func (r *GameEventDefinitionRepository) Update(ctx context.Context, id, gameID, code string, displayName sql.NullString, messageTemplate string, imageData sql.NullString, color string, examplePlaceholderValues map[string]string) error {
	var disp any
	if displayName.Valid {
		disp = displayName.String
	} else {
		disp = nil
	}
	exJSON, err := marshalExamplePlaceholderJSON(examplePlaceholderValues)
	if err != nil {
		return fmt.Errorf("marshal example placeholders: %w", err)
	}
	res, err := r.db.ExecContext(ctx,
		`UPDATE game_event_definitions SET code = $3, display_name = $4, message_template = $5, image_data = $6, color = $7, example_placeholder_values = $8::jsonb
		 WHERE id = $1 AND game_id = $2`,
		id, gameID, code, disp, messageTemplate, imageData, color, exJSON,
	)
	if err != nil {
		return fmt.Errorf("update event definition: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *GameEventDefinitionRepository) Delete(ctx context.Context, id, gameID string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM game_event_definitions WHERE id = $1 AND game_id = $2`,
		id, gameID,
	)
	if err != nil {
		return fmt.Errorf("delete event definition: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}
