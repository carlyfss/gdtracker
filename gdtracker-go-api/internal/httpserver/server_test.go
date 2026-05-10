package httpserver

import "testing"

func TestValidateCreds(t *testing.T) {
	if err := validateCreds(authCreds{Username: "", Password: "x"}); err == nil {
		t.Fatal("want error")
	}
	if err := validateCreds(authCreds{Username: "u", Password: ""}); err == nil {
		t.Fatal("want error")
	}
	if err := validateCreds(authCreds{Username: "  ", Password: "p"}); err == nil {
		t.Fatal("want error for blank username")
	}
	if err := validateCreds(authCreds{Username: "u", Password: "p"}); err != nil {
		t.Fatal(err)
	}
}
