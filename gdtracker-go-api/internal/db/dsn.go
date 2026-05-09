package db

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

// PostgresDSNFromEnv builds a libpq/postgres URL from the same variables as Spring Boot
// (`gdtracker-api` application.properties): DB_URL (JDBC), DB_USERNAME, DB_PASSWORD.
func PostgresDSNFromEnv() (string, error) {
	jdbc := strings.TrimSpace(os.Getenv("DB_URL"))
	user := strings.TrimSpace(os.Getenv("DB_USERNAME"))
	pass := os.Getenv("DB_PASSWORD")
	if jdbc == "" {
		return "", fmt.Errorf("DB_URL is required for database connectivity")
	}
	if user == "" {
		return "", fmt.Errorf("DB_USERNAME is required for database connectivity")
	}
	if pass == "" {
		return "", fmt.Errorf("DB_PASSWORD is required for database connectivity")
	}
	return PostgresDSNFromJDBC(jdbc, user, pass)
}

// PostgresDSNFromJDBC converts jdbc:postgresql://host:port/dbname[?params] into postgres://...
func PostgresDSNFromJDBC(jdbcURL, username, password string) (string, error) {
	jdbcURL = strings.TrimSpace(jdbcURL)
	const (
		prefixSlashes = "jdbc:postgresql://"
		prefixNoSlash = "jdbc:postgresql:"
	)
	var remainder string
	switch {
	case strings.HasPrefix(jdbcURL, prefixSlashes):
		remainder = strings.TrimPrefix(jdbcURL, prefixSlashes)
	case strings.HasPrefix(jdbcURL, prefixNoSlash):
		remainder = strings.TrimPrefix(jdbcURL, prefixNoSlash)
	default:
		return "", fmt.Errorf("DB_URL must start with %q or %q", prefixSlashes, prefixNoSlash)
	}

	hostPort, dbName, query := splitJDBCPath(remainder)
	if dbName == "" {
		return "", fmt.Errorf("DB_URL: missing database name in path")
	}

	u := url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(username, password),
		Host:   hostPort,
		Path:   "/" + dbName,
	}
	if query != "" {
		q, err := url.ParseQuery(query)
		if err != nil {
			return "", fmt.Errorf("DB_URL query: %w", err)
		}
		u.RawQuery = q.Encode()
	}
	return u.String(), nil
}

// splitJDBCPath parses host[:port]/database[?query] after the jdbc:postgresql:// prefix.
func splitJDBCPath(remainder string) (hostPort, database, rawQuery string) {
	qIdx := strings.IndexByte(remainder, '?')
	queryPart := ""
	if qIdx >= 0 {
		queryPart = remainder[qIdx+1:]
		remainder = remainder[:qIdx]
	}
	slash := strings.IndexByte(remainder, '/')
	if slash < 0 {
		return remainder, "", queryPart
	}
	hostPort = remainder[:slash]
	dbPart := remainder[slash+1:]
	return hostPort, dbPart, queryPart
}
