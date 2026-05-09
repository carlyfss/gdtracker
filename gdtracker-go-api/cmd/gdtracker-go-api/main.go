package main

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/db"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/httpx"
)

func main() {
	logger := log.New(os.Stdout, "", log.LstdFlags)
	if err := run(context.Background(), logger); err != nil {
		logger.Fatalf("%v", err)
	}
}

func run(ctx context.Context, logger *log.Logger) error {
	var sqlDB *sql.DB
	dsn, err := db.PostgresDSNFromEnv()
	if err != nil {
		logger.Printf("database: disabled (%v); serving without Postgres", err)
	} else {
		sqlDB, err = db.OpenPostgres(dsn)
		if err != nil {
			return err
		}
		defer func() { _ = sqlDB.Close() }()

		if err := db.Ping(ctx, sqlDB); err != nil {
			return err
		}
		logger.Printf("database: connected")

		if err := db.MigrateUp(ctx, sqlDB); err != nil {
			return err
		}
		logger.Printf("database: migrate mode %q (auto skips when Liquibase databasechangelog exists)", db.AutoMigrateMode())
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		if sqlDB == nil {
			httpx.WriteJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "no database"})
			return
		}
		rctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := db.Ping(rctx, sqlDB); err != nil {
			httpx.WriteJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "unavailable"})
			return
		}
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	server := &http.Server{
		Addr:              httpx.AddrFromEnv("PORT", "8080"),
		Handler:           httpx.WithRequestLogging(logger, mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	ctx, stop := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		_ = server.Shutdown(shutdownCtx)
	}()

	logger.Printf("listening on %s", server.Addr)
	err = server.ListenAndServe()
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
