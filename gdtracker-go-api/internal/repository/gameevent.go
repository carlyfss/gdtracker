package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// GameEventRow is a persisted game_events row with joined definition fields for API responses.
type GameEventRow struct {
	ID              string
	DefinitionID    string
	DefinitionCode  string
	DefinitionColor string
	GamePlayerID    sql.NullString
	RenderedMessage string
	Payload         map[string]string
	Timestamp       time.Time
}

type GameEventRepository struct {
	db *sql.DB
}

func NewGameEventRepository(db *sql.DB) *GameEventRepository {
	return &GameEventRepository{db: db}
}

func (r *GameEventRepository) ExistsByDefinitionID(ctx context.Context, definitionID string) (bool, error) {
	var n int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(1) FROM game_events WHERE definition_id = $1`,
		definitionID,
	).Scan(&n)
	if err != nil {
		return false, fmt.Errorf("exists events by definition: %w", err)
	}
	return n > 0, nil
}

// FindByID loads event with definition; nil if missing.
func (r *GameEventRepository) FindByID(ctx context.Context, eventID string) (*GameEventRow, error) {
	var (
		row GameEventRow
		raw []byte
	)
	err := r.db.QueryRowContext(ctx,
		`SELECT e.id, e.definition_id, d.code, d.color, e.game_player_id, e.rendered_message, e.payload, e.timestamp
		 FROM game_events e
		 JOIN game_event_definitions d ON d.id = e.definition_id
		 WHERE e.id = $1`,
		eventID,
	).Scan(&row.ID, &row.DefinitionID, &row.DefinitionCode, &row.DefinitionColor, &row.GamePlayerID, &row.RenderedMessage, &raw, &row.Timestamp)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find game event: %w", err)
	}
	if err := json.Unmarshal(raw, &row.Payload); err != nil {
		return nil, fmt.Errorf("payload json: %w", err)
	}
	return &row, nil
}

// GameIDForEvent returns game_id for an event, or empty if not found.
func (r *GameEventRepository) GameIDForEvent(ctx context.Context, eventID string) (string, error) {
	var gid string
	err := r.db.QueryRowContext(ctx, `SELECT game_id FROM game_events WHERE id = $1`, eventID).Scan(&gid)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("game id for event: %w", err)
	}
	return gid, nil
}

func (r *GameEventRepository) ListFiltered(ctx context.Context, gameID, code, q string, limit int) ([]GameEventRow, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT e.id, e.definition_id, d.code, d.color, e.game_player_id, e.rendered_message, e.payload, e.timestamp
		 FROM game_events e
		 JOIN game_event_definitions d ON d.id = e.definition_id
		 WHERE e.game_id = $1
		   AND ($2 = '' OR LOWER(d.code) = LOWER($2))
		   AND ($3 = '' OR LOWER(e.rendered_message) LIKE LOWER('%' || $3 || '%') OR LOWER(d.code) LIKE LOWER('%' || $3 || '%'))
		 ORDER BY e.timestamp DESC
		 LIMIT $4`,
		gameID, code, q, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("list game events: %w", err)
	}
	defer func() { _ = rows.Close() }()
	return scanGameEventRows(rows)
}

type GameEventPage struct {
	Content       []GameEventRow
	TotalElements int64
	TotalPages    int
	Number        int
	Size          int
}

func (r *GameEventRepository) Search(ctx context.Context, gameID, code, q, playerID string, page, size int) (*GameEventPage, error) {
	var total int64
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*)
		 FROM game_events e
		 JOIN game_event_definitions d ON d.id = e.definition_id
		 LEFT JOIN game_players gp ON gp.id = e.game_player_id
		 WHERE e.game_id = $1
		   AND ($2 = '' OR gp.id = $2)
		   AND ($3 = '' OR LOWER(d.code) = LOWER($3))
		   AND ($4 = '' OR LOWER(e.rendered_message) LIKE LOWER('%' || $4 || '%') OR LOWER(d.code) LIKE LOWER('%' || $4 || '%'))`,
		gameID, playerID, code, q,
	).Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("count game events: %w", err)
	}
	totalPages := 0
	if total > 0 {
		totalPages = int((total + int64(size) - 1) / int64(size))
	}
	offset := page * size
	rows, err := r.db.QueryContext(ctx,
		`SELECT e.id, e.definition_id, d.code, d.color, e.game_player_id, e.rendered_message, e.payload, e.timestamp
		 FROM game_events e
		 JOIN game_event_definitions d ON d.id = e.definition_id
		 LEFT JOIN game_players gp ON gp.id = e.game_player_id
		 WHERE e.game_id = $1
		   AND ($2 = '' OR gp.id = $2)
		   AND ($3 = '' OR LOWER(d.code) = LOWER($3))
		   AND ($4 = '' OR LOWER(e.rendered_message) LIKE LOWER('%' || $4 || '%') OR LOWER(d.code) LIKE LOWER('%' || $4 || '%'))
		 ORDER BY e.timestamp DESC
		 LIMIT $5 OFFSET $6`,
		gameID, playerID, code, q, size, offset,
	)
	if err != nil {
		return nil, fmt.Errorf("search game events: %w", err)
	}
	defer func() { _ = rows.Close() }()
	content, err := scanGameEventRows(rows)
	if err != nil {
		return nil, err
	}
	return &GameEventPage{
		Content:       content,
		TotalElements: total,
		TotalPages:    totalPages,
		Number:        page,
		Size:          size,
	}, nil
}

func scanGameEventRows(rows *sql.Rows) ([]GameEventRow, error) {
	var out []GameEventRow
	for rows.Next() {
		var row GameEventRow
		var raw []byte
		if err := rows.Scan(&row.ID, &row.DefinitionID, &row.DefinitionCode, &row.DefinitionColor, &row.GamePlayerID, &row.RenderedMessage, &raw, &row.Timestamp); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(raw, &row.Payload); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *GameEventRepository) Insert(ctx context.Context, id, gameID, definitionID string, playerID sql.NullString, rendered string, payload map[string]string, ts time.Time) error {
	if payload == nil {
		payload = map[string]string{}
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("payload marshal: %w", err)
	}
	_, err = r.db.ExecContext(ctx,
		`INSERT INTO game_events (id, game_id, definition_id, game_player_id, rendered_message, payload, timestamp)
		 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
		id, gameID, definitionID, playerID, rendered, string(raw), ts,
	)
	if err != nil {
		return fmt.Errorf("insert game event: %w", err)
	}
	return nil
}
