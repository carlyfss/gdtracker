package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// GameEventTraceRow is a trace with optional joined event/definition fields for API.
type GameEventTraceRow struct {
	ID              string
	Location        sql.NullString
	Map             sql.NullString
	GamePlayerID    sql.NullString
	Timestamp       time.Time
	GameEventID     sql.NullString
	RenderedMessage sql.NullString
	DefinitionCode  sql.NullString
	DefinitionColor sql.NullString
}

type GameEventTraceRepository struct {
	db *sql.DB
}

func NewGameEventTraceRepository(db *sql.DB) *GameEventTraceRepository {
	return &GameEventTraceRepository{db: db}
}

func (r *GameEventTraceRepository) ListByGameOrderByTimestampDesc(ctx context.Context, gameID string) ([]GameEventTraceRow, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT t.id, t.location, t.map, t.game_player_id, t.timestamp, t.game_event_id,
		        e.rendered_message, d.code, d.color
		 FROM game_event_traces t
		 LEFT JOIN game_events e ON e.id = t.game_event_id
		 LEFT JOIN game_event_definitions d ON d.id = e.definition_id
		 WHERE t.game_id = $1
		 ORDER BY t.timestamp DESC`,
		gameID,
	)
	if err != nil {
		return nil, fmt.Errorf("list traces: %w", err)
	}
	defer func() { _ = rows.Close() }()
	return scanTraceRows(rows)
}

func (r *GameEventTraceRepository) ListByGameAndPlayerOrderByTimestampDesc(ctx context.Context, gameID, playerID string) ([]GameEventTraceRow, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT t.id, t.location, t.map, t.game_player_id, t.timestamp, t.game_event_id,
		        e.rendered_message, d.code, d.color
		 FROM game_event_traces t
		 LEFT JOIN game_events e ON e.id = t.game_event_id
		 LEFT JOIN game_event_definitions d ON d.id = e.definition_id
		 WHERE t.game_id = $1 AND t.game_player_id = $2
		 ORDER BY t.timestamp DESC`,
		gameID, playerID,
	)
	if err != nil {
		return nil, fmt.Errorf("list traces by player: %w", err)
	}
	defer func() { _ = rows.Close() }()
	return scanTraceRows(rows)
}

func scanTraceRows(rows *sql.Rows) ([]GameEventTraceRow, error) {
	var out []GameEventTraceRow
	for rows.Next() {
		var t GameEventTraceRow
		if err := rows.Scan(&t.ID, &t.Location, &t.Map, &t.GamePlayerID, &t.Timestamp, &t.GameEventID,
			&t.RenderedMessage, &t.DefinitionCode, &t.DefinitionColor); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *GameEventTraceRepository) Insert(ctx context.Context, id, gameID string, location, mapVal string, playerID sql.NullString, gameEventID sql.NullString, ts time.Time) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO game_event_traces (id, game_id, location, map, timestamp, game_player_id, game_event_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		id, gameID, location, mapVal, ts, playerID, gameEventID,
	)
	if err != nil {
		return fmt.Errorf("insert trace: %w", err)
	}
	return nil
}

func (r *GameEventTraceRepository) FindByID(ctx context.Context, traceID string) (*GameEventTraceRow, error) {
	var t GameEventTraceRow
	err := r.db.QueryRowContext(ctx,
		`SELECT t.id, t.location, t.map, t.game_player_id, t.timestamp, t.game_event_id,
		        e.rendered_message, d.code, d.color
		 FROM game_event_traces t
		 LEFT JOIN game_events e ON e.id = t.game_event_id
		 LEFT JOIN game_event_definitions d ON d.id = e.definition_id
		 WHERE t.id = $1`,
		traceID,
	).Scan(&t.ID, &t.Location, &t.Map, &t.GamePlayerID, &t.Timestamp, &t.GameEventID,
		&t.RenderedMessage, &t.DefinitionCode, &t.DefinitionColor)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find trace: %w", err)
	}
	return &t, nil
}
