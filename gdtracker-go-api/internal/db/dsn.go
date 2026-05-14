package db

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

// PostgresDSNFromEnv builds a libpq URL from DB_URL (postgresql://…), DB_USERNAME, and DB_PASSWORD.
func PostgresDSNFromEnv() (string, error) {
	dbURL := strings.TrimSpace(os.Getenv("DB_URL"))
	user := strings.TrimSpace(os.Getenv("DB_USERNAME"))
	pass := os.Getenv("DB_PASSWORD")
	if dbURL == "" {
		return "", fmt.Errorf("DB_URL is required for database connectivity")
	}
	if user == "" {
		return "", fmt.Errorf("DB_USERNAME is required for database connectivity")
	}
	if pass == "" {
		return "", fmt.Errorf("DB_PASSWORD is required for database connectivity")
	}
	return PostgresDSNFromDBURL(dbURL, user, pass)
}

// PostgresDSNFromDBURL parses DB_URL as postgresql://host[:port]/dbname[?query], applies username/password
// from the caller, and returns a postgres:// URL suitable for database/sql with lib/pq.
func PostgresDSNFromDBURL(dbURL, username, password string) (string, error) {
	dbURL = strings.TrimSpace(dbURL)
	if strings.HasPrefix(strings.ToLower(dbURL), "jdbc:") {
		return "", fmt.Errorf("DB_URL must use postgresql:// (jdbc:postgresql:// is no longer supported)")
	}
	u, err := url.Parse(dbURL)
	if err != nil {
		return "", fmt.Errorf("DB_URL: %w", err)
	}
	if !strings.EqualFold(u.Scheme, "postgresql") {
		return "", fmt.Errorf("DB_URL must use postgresql:// scheme (got %q)", u.Scheme)
	}
	dbName := strings.TrimPrefix(u.Path, "/")
	if dbName == "" {
		return "", fmt.Errorf("DB_URL: missing database name in path (e.g. postgresql://host:5432/dbname)")
	}

	out := *u
	out.Scheme = "postgres"
	out.User = url.UserPassword(username, password)

	q := out.Query()
	if q.Get("sslmode") == "" {
		q.Set("sslmode", "prefer")
	}
	out.RawQuery = q.Encode()
	return out.String(), nil
}
