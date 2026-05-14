package db

import (
	"net/url"
	"testing"
)

func TestPostgresDSNFromDBURL_DefaultPort(t *testing.T) {
	got, err := PostgresDSNFromDBURL("postgresql://localhost:5432/numb_tracker", "numb_tracker", "secret")
	if err != nil {
		t.Fatal(err)
	}
	u, err := url.Parse(got)
	if err != nil {
		t.Fatal(err)
	}
	if u.Query().Get("sslmode") != "prefer" {
		t.Fatalf("sslmode = %q, want prefer", u.Query().Get("sslmode"))
	}
}

func TestPostgresDSNFromDBURL_QueryParams(t *testing.T) {
	got, err := PostgresDSNFromDBURL(
		"postgresql://db.example.com:5432/appdb?sslmode=require&currentSchema=public",
		"u",
		"p@ss",
	)
	if err != nil {
		t.Fatal(err)
	}
	u, err := ParsePostgresURL(got)
	if err != nil {
		t.Fatal(err)
	}
	if u.Hostname() != "db.example.com" {
		t.Fatalf("host %q", u.Hostname())
	}
	if u.Path != "/appdb" {
		t.Fatalf("path %q", u.Path)
	}
	if u.Query().Get("sslmode") != "require" {
		t.Fatalf("sslmode %q", u.Query().Get("sslmode"))
	}
	if u.User.Username() != "u" {
		t.Fatalf("user %q", u.User.Username())
	}
	pw, _ := u.User.Password()
	if pw != "p@ss" {
		t.Fatalf("password not preserved")
	}
}

func TestPostgresDSNFromDBURL_NoPort(t *testing.T) {
	got, err := PostgresDSNFromDBURL("postgresql://localhost/mydb", "a", "b")
	if err != nil {
		t.Fatal(err)
	}
	u, err := url.Parse(got)
	if err != nil {
		t.Fatal(err)
	}
	if u.Query().Get("sslmode") != "prefer" {
		t.Fatalf("sslmode = %q, want prefer", u.Query().Get("sslmode"))
	}
}

func TestPostgresDSNFromDBURL_InvalidScheme(t *testing.T) {
	_, err := PostgresDSNFromDBURL("mysql://localhost/x", "a", "b")
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestPostgresDSNFromDBURL_PostgresSchemeRejected(t *testing.T) {
	_, err := PostgresDSNFromDBURL("postgres://localhost:5432/mydb", "a", "b")
	if err == nil {
		t.Fatal("expected error for postgres:// scheme")
	}
}

func TestPostgresDSNFromDBURL_JDBCRejected(t *testing.T) {
	_, err := PostgresDSNFromDBURL("jdbc:postgresql://localhost:5432/mydb", "a", "b")
	if err == nil {
		t.Fatal("expected error for jdbc URL")
	}
}

// ParsePostgresURL is a test helper around url.Parse.
func ParsePostgresURL(s string) (*url.URL, error) {
	return url.Parse(s)
}
