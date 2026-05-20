package main

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/db"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

// Auth0 bulk-import row (Database Connection).
type auth0ImportUser struct {
	UserID       string `json:"user_id,omitempty"`
	Username     string `json:"username"`
	PasswordHash string `json:"password_hash"`
	Email        string `json:"email,omitempty"`
}

func main() {
	exportPath := flag.String("export-import-json", "", "Write Auth0 bulk-import JSON from Postgres users")
	backfillPath := flag.String("backfill-csv", "", "CSV with columns id,auth0_sub to update users.auth0_sub")
	flag.Parse()

	if *exportPath == "" && *backfillPath == "" {
		flag.Usage()
		os.Exit(2)
	}

	ctx := context.Background()
	dsn, err := db.PostgresDSNFromEnv()
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	sqlDB, err := db.OpenPostgres(dsn)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer func() { _ = sqlDB.Close() }()
	if err := db.Ping(ctx, sqlDB); err != nil {
		log.Fatalf("ping db: %v", err)
	}

	users := repository.NewUserRepository(sqlDB)

	if *exportPath != "" {
		if err := exportImportJSON(ctx, users, *exportPath); err != nil {
			log.Fatalf("export: %v", err)
		}
		log.Printf("wrote Auth0 import JSON to %s", *exportPath)
	}

	if *backfillPath != "" {
		if err := backfillAuth0Subs(ctx, users, *backfillPath); err != nil {
			log.Fatalf("backfill: %v", err)
		}
		log.Printf("backfilled auth0_sub from %s", *backfillPath)
	}
}

func exportImportJSON(ctx context.Context, users *repository.UserRepository, path string) error {
	rows, err := users.ListAll(ctx)
	if err != nil {
		return err
	}

	out := make([]auth0ImportUser, 0, len(rows))
	for _, u := range rows {
		hash, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("hash password for %q: %w", u.Username, err)
		}
		out = append(out, auth0ImportUser{
			UserID:       u.ID,
			Username:     u.Username,
			PasswordHash: string(hash),
		})
	}

	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()

	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	return enc.Encode(out)
}

func backfillAuth0Subs(ctx context.Context, users *repository.UserRepository, path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()

	r := csv.NewReader(f)
	r.TrimLeadingSpace = true
	records, err := r.ReadAll()
	if err != nil {
		return err
	}
	if len(records) < 2 {
		return fmt.Errorf("csv must include header and at least one row")
	}

	idIdx, subIdx := -1, -1
	for i, h := range records[0] {
		switch strings.ToLower(strings.TrimSpace(h)) {
		case "id":
			idIdx = i
		case "auth0_sub":
			subIdx = i
		}
	}
	if idIdx < 0 || subIdx < 0 {
		return fmt.Errorf("csv header must include id and auth0_sub columns")
	}

	for _, row := range records[1:] {
		if len(row) <= idIdx || len(row) <= subIdx {
			continue
		}
		id := strings.TrimSpace(row[idIdx])
		sub := strings.TrimSpace(row[subIdx])
		if id == "" || sub == "" {
			continue
		}
		if err := users.UpdateAuth0Sub(ctx, id, sub); err != nil {
			return fmt.Errorf("update %q: %w", id, err)
		}
	}
	return nil
}
