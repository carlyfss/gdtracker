package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type GameExceptionRow struct {
	ID                string
	ErrorMessage      sql.NullString
	ShortErrorMessage sql.NullString
	Location          sql.NullString
	Map               sql.NullString
	StackTrace        sql.NullString
	Timestamp         time.Time
	GamePlayerID      sql.NullString
}

type GameExceptionRepository struct {
	db *sql.DB
}

func NewGameExceptionRepository(db *sql.DB) *GameExceptionRepository {
	return &GameExceptionRepository{db: db}
}

func (r *GameExceptionRepository) ListByGameOrderByTimestampDesc(ctx context.Context, gameID string) ([]GameExceptionRow, error) {
	rows, err := r.db.QueryContext(ctx, `
SELECT id, error_message, short_error_message, location, map, stack_trace, timestamp, game_player_id
FROM game_exceptions WHERE game_id = $1 ORDER BY timestamp DESC`, gameID)
	if err != nil {
		return nil, fmt.Errorf("list exceptions: %w", err)
	}
	defer func() { _ = rows.Close() }()
	return scanGameExceptions(rows)
}

func (r *GameExceptionRepository) ListByGameAndTimestampBetween(ctx context.Context, gameID string, from, to time.Time) ([]GameExceptionRow, error) {
	rows, err := r.db.QueryContext(ctx, `
SELECT id, error_message, short_error_message, location, map, stack_trace, timestamp, game_player_id
FROM game_exceptions WHERE game_id = $1 AND timestamp >= $2 AND timestamp <= $3 ORDER BY timestamp DESC`,
		gameID, from, to)
	if err != nil {
		return nil, fmt.Errorf("list exceptions interval: %w", err)
	}
	defer func() { _ = rows.Close() }()
	return scanGameExceptions(rows)
}

func scanGameExceptions(rows *sql.Rows) ([]GameExceptionRow, error) {
	var out []GameExceptionRow
	for rows.Next() {
		var e GameExceptionRow
		if err := rows.Scan(&e.ID, &e.ErrorMessage, &e.ShortErrorMessage, &e.Location, &e.Map, &e.StackTrace, &e.Timestamp, &e.GamePlayerID); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (r *GameExceptionRepository) FindByIDAndGame(ctx context.Context, id, gameID string) (*GameExceptionRow, error) {
	var e GameExceptionRow
	err := r.db.QueryRowContext(ctx, `
SELECT id, error_message, short_error_message, location, map, stack_trace, timestamp, game_player_id
FROM game_exceptions WHERE id = $1 AND game_id = $2`, id, gameID).Scan(
		&e.ID, &e.ErrorMessage, &e.ShortErrorMessage, &e.Location, &e.Map, &e.StackTrace, &e.Timestamp, &e.GamePlayerID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &e, nil
}

type GameExceptionSearchPage struct {
	Content       []GameExceptionRow
	TotalElements int64
	TotalPages    int
	Number        int
	Size          int
}

func (r *GameExceptionRepository) SearchForGame(ctx context.Context, gameID, q string, page, size int) (*GameExceptionSearchPage, error) {
	if size <= 0 {
		size = 10
	}
	if size > 100 {
		size = 100
	}
	if page < 0 {
		page = 0
	}
	offset := page * size

	where := `WHERE game_id = $1`
	args := []interface{}{gameID}
	if q != "" {
		where += ` AND (
			LOWER(id::text) LIKE LOWER($2)
			OR LOWER(COALESCE(short_error_message,'')) LIKE LOWER($2)
			OR LOWER(COALESCE(error_message,'')) LIKE LOWER($2)
			OR LOWER(COALESCE(stack_trace,'')) LIKE LOWER($2)
		)`
		pat := "%" + q + "%"
		args = append(args, pat)
	}

	countSQL := `SELECT COUNT(1) FROM game_exceptions ` + where
	var total int64
	if err := r.db.QueryRowContext(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("search count: %w", err)
	}

	listSQL := `SELECT id, error_message, short_error_message, location, map, stack_trace, timestamp, game_player_id
		FROM game_exceptions ` + where + ` ORDER BY timestamp DESC LIMIT ` + fmt.Sprintf("%d", size) + ` OFFSET ` + fmt.Sprintf("%d", offset)

	rows, err := r.db.QueryContext(ctx, listSQL, args...)
	if err != nil {
		return nil, fmt.Errorf("search list: %w", err)
	}
	defer func() { _ = rows.Close() }()
	content, err := scanGameExceptions(rows)
	if err != nil {
		return nil, err
	}
	totalPages := int((total + int64(size) - 1) / int64(size))
	if total == 0 {
		totalPages = 0
	}
	return &GameExceptionSearchPage{
		Content:       content,
		TotalElements: total,
		TotalPages:    totalPages,
		Number:        page,
		Size:          size,
	}, nil
}

func (r *GameExceptionRepository) InsertForGame(ctx context.Context, gameID string, e *GameExceptionRow) (*GameExceptionRow, error) {
	id := e.ID
	if id == "" {
		id = uuid.NewString()
	}
	ts := e.Timestamp
	if ts.IsZero() {
		ts = time.Now().UTC()
	}
	_, err := r.db.ExecContext(ctx, `
INSERT INTO game_exceptions (id, error_message, short_error_message, location, map, stack_trace, timestamp, game_id, game_player_id)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		id, e.ErrorMessage, e.ShortErrorMessage, e.Location, e.Map, e.StackTrace, ts, gameID, e.GamePlayerID,
	)
	if err != nil {
		return nil, err
	}
	out := *e
	out.ID = id
	out.Timestamp = ts
	return &out, nil
}

func (r *GameExceptionRepository) InsertIngest(ctx context.Context, gameID, playerID string, errorMessage, shortMsg, location, mapVal, stack sql.NullString) (*GameExceptionRow, error) {
	id := uuid.NewString()
	ts := time.Now().UTC()
	var pid sql.NullString
	if playerID != "" {
		pid = sql.NullString{String: playerID, Valid: true}
	}
	_, err := r.db.ExecContext(ctx, `
INSERT INTO game_exceptions (id, error_message, short_error_message, location, map, stack_trace, timestamp, game_id, game_player_id)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		id, errorMessage, shortMsg, location, mapVal, stack, ts, gameID, pid,
	)
	if err != nil {
		return nil, err
	}
	return &GameExceptionRow{
		ID: id, ErrorMessage: errorMessage, ShortErrorMessage: shortMsg, Location: location, Map: mapVal,
		StackTrace: stack, Timestamp: ts, GamePlayerID: pid,
	}, nil
}
