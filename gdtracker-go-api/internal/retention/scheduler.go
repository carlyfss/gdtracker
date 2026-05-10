package retention

import (
	"context"
	"database/sql"
	"log"
	"time"
)

// Start launches a goroutine that runs PurgeExpiredArchived daily at cfg.Hour:cfg.Minute in cfg.Location.
// Exits when ctx is cancelled. No-op if !cfg.Enabled or db is nil.
func Start(ctx context.Context, db *sql.DB, logger *log.Logger, cfg Config) {
	if db == nil || !cfg.Enabled {
		if logger != nil && db != nil && !cfg.Enabled {
			logger.Printf("archive retention: disabled (GDTRACKER_ARCHIVE_RETENTION)")
		}
		return
	}
	loc := cfg.Location
	if loc == nil {
		loc = time.UTC
	}
	if logger != nil {
		logger.Printf("archive retention: enabled; schedule %02d:%02d %s", cfg.Hour, cfg.Minute, loc.String())
	}
	go func() {
		for {
			now := time.Now()
			next := NextRun(now, loc, cfg.Hour, cfg.Minute)
			d := next.Sub(now)
			if d < time.Second {
				d = time.Second
			}
			select {
			case <-ctx.Done():
				return
			case <-time.After(d):
				runCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
				err := PurgeExpiredArchived(runCtx, db, logger)
				cancel()
				if err != nil && logger != nil {
					logger.Printf("archive retention: purge error: %v", err)
				}
			}
		}
	}()
}
