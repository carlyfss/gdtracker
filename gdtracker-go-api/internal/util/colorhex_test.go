package util

import "testing"

func TestValidateColorHex(t *testing.T) {
	got, err := ValidateColorHex("#ABCDEF")
	if err != nil || got != "#abcdef" {
		t.Fatalf("ValidateColorHex = %q, %v", got, err)
	}
	if _, err := ValidateColorHex("ABCDEF"); err == nil {
		t.Fatal("expected error without hash")
	}
	if _, err := ValidateColorHex("#ABCDE"); err == nil {
		t.Fatal("expected error for short hex")
	}
}

func TestResolveColorForCreate_Default(t *testing.T) {
	got, err := ResolveColorForCreate("  ", "#111111")
	if err != nil || got != "#111111" {
		t.Fatalf("ResolveColorForCreate = %q, %v", got, err)
	}
}
