package main

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/db"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/httpserver"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/httpx"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/retention"
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
		logger.Printf("database: migrate mode %q (off skips embedded migrations)", db.AutoMigrateMode())
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

	if sqlDB != nil {
		secret := strings.TrimSpace(os.Getenv("GDTRACKER_SESSION_SECRET"))
		if secret == "" {
			return errors.New("GDTRACKER_SESSION_SECRET is required when DB_URL is set")
		}
		corsOrigins := os.Getenv("GDTRACKER_CORS_ALLOWED_ORIGINS")
		cookieDomain := strings.TrimSpace(os.Getenv("GDTRACKER_COOKIE_DOMAIN"))
		cookieSecure := strings.TrimSpace(os.Getenv("GDTRACKER_COOKIE_SECURE")) == "true"
		srv, err := httpserver.New(httpserver.Config{
			DB:            sqlDB,
			SessionSecret: secret,
			CookieDomain:  cookieDomain,
			CookieSecure:  cookieSecure,
		})
		if err != nil {
			return err
		}
		mux.Handle("/api/", srv.APIHandler(corsOrigins))
		logger.Printf("api: /api mounted (CORS from GDTRACKER_CORS_ALLOWED_ORIGINS)")
	}

	server := &http.Server{
		Addr:              httpx.AddrFromEnv("PORT", "8080"),
		Handler:           httpx.WithRequestLogging(logger, mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	ctx, stop := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
	defer stop()

	if sqlDB != nil {
		retention.Start(ctx, sqlDB, logger, retention.ConfigFromEnv())
	}

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
