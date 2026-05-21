package retention

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"time"
)

// AdvisoryLockKey is a process-wide constant for archive retention (multi-replica exclusion).
const AdvisoryLockKey int64 = 0x4744545241523154 // 'GDTRAR1T' pattern

// PurgeExpiredArchived runs one pass: Spring ArchiveRetentionService.purgeExpiredArchivedItems parity.
// Uses a dedicated connection so pg_advisory_lock / unlock match the same session.
func PurgeExpiredArchived(ctx context.Context, db *sql.DB, logger *log.Logger) error {
	conn, err := db.Conn(ctx)
	if err != nil {
		return fmt.Errorf("retention conn: %w", err)
	}
	defer func() { _ = conn.Close() }()

	var locked bool
	if err := conn.QueryRowContext(ctx, `SELECT pg_try_advisory_lock($1)`, AdvisoryLockKey).Scan(&locked); err != nil {
		return fmt.Errorf("retention advisory lock: %w", err)
	}
	if !locked {
		if logger != nil {
			logger.Printf("archive retention: skipped (advisory lock held by another session)")
		}
		return nil
	}
	defer func() {
		_, _ = conn.ExecContext(context.Background(), `SELECT pg_advisory_unlock($1)`, AdvisoryLockKey)
	}()

	ids, err := listAllGameIDs(ctx, conn)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	for _, gameID := range ids {
		settings, err := loadSettingsJSON(ctx, conn, gameID)
		if err != nil {
			return err
		}
		days := ResolveArchiveDays(settings)
		cutoff := now.Add(-time.Duration(days) * 24 * time.Hour)

		deletedTasks, err := deleteArchivedTasksBefore(ctx, conn, gameID, cutoff)
		if err != nil {
			return err
		}
		deletedFeatures, err := deleteArchivedFeaturesBefore(ctx, conn, gameID, cutoff)
		if err != nil {
			return err
		}
		if deletedTasks > 0 || deletedFeatures > 0 {
			if logger != nil {
				logger.Printf(
					"archive retention purged gameId=%s days=%d cutoff=%s deletedTasks=%d deletedFeatures=%d",
					gameID, days, cutoff.Format(time.RFC3339), deletedTasks, deletedFeatures,
				)
			}
		}
	}
	return nil
}

func listAllGameIDs(ctx context.Context, conn *sql.Conn) ([]string, error) {
	rows, err := conn.QueryContext(ctx, `SELECT id FROM games WHERE deleted_at IS NULL`)
	if err != nil {
		return nil, fmt.Errorf("list games: %w", err)
	}
	defer func() { _ = rows.Close() }()
	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func loadSettingsJSON(ctx context.Context, conn *sql.Conn, gameID string) ([]byte, error) {
	var raw []byte
	err := conn.QueryRowContext(ctx,
		`SELECT settings FROM game_configurations WHERE game_id = $1`,
		gameID,
	).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("load settings: %w", err)
	}
	return raw, nil
}

func deleteArchivedTasksBefore(ctx context.Context, conn *sql.Conn, gameID string, cutoff time.Time) (int64, error) {
	res, err := conn.ExecContext(ctx, `
DELETE FROM tasks t
USING features f
WHERE t.feature_id = f.id
  AND f.game_id = $1
  AND t.archived_at IS NOT NULL
  AND t.archived_at < $2`,
		gameID, cutoff,
	)
	if err != nil {
		return 0, fmt.Errorf("delete archived tasks: %w", err)
	}
	return res.RowsAffected()
}

func deleteArchivedFeaturesBefore(ctx context.Context, conn *sql.Conn, gameID string, cutoff time.Time) (int64, error) {
	res, err := conn.ExecContext(ctx, `
DELETE FROM features
WHERE game_id = $1
  AND archived_at IS NOT NULL
  AND archived_at < $2`,
		gameID, cutoff,
	)
	if err != nil {
		return 0, fmt.Errorf("delete archived features: %w", err)
	}
	return res.RowsAffected()
}
