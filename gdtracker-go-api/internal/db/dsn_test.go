package db

import (
	"net/url"
	"testing"
)

func TestPostgresDSNFromJDBC_DefaultPort(t *testing.T) {
	got, err := PostgresDSNFromJDBC("jdbc:postgresql://localhost:5432/numb_tracker", "numb_tracker", "secret")
	if err != nil {
		t.Fatal(err)
	}
	want := "postgres://numb_tracker:secret@localhost:5432/numb_tracker"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestPostgresDSNFromJDBC_QueryParams(t *testing.T) {
	got, err := PostgresDSNFromJDBC(
		"jdbc:postgresql://db.example.com:5432/appdb?sslmode=require&currentSchema=public",
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

func TestPostgresDSNFromJDBC_NoPort(t *testing.T) {
	got, err := PostgresDSNFromJDBC("jdbc:postgresql://localhost/mydb", "a", "b")
	if err != nil {
		t.Fatal(err)
	}
	if got != "postgres://a:b@localhost/mydb" {
		t.Fatalf("got %q", got)
	}
}

func TestPostgresDSNFromJDBC_InvalidPrefix(t *testing.T) {
	_, err := PostgresDSNFromJDBC("mysql://localhost/x", "a", "b")
	if err == nil {
		t.Fatal("expected error")
	}
}

// ParsePostgresURL is a test helper around url.Parse.
func ParsePostgresURL(s string) (*url.URL, error) {
	return url.Parse(s)
}
