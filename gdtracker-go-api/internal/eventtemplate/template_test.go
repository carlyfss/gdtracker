package eventtemplate

import "testing"

func TestNormalizeKeys(t *testing.T) {
	m := NormalizeKeys(map[string]string{"player-id": "x", "": "skip"})
	if m["PLAYER_ID"] != "x" {
		t.Fatalf("got %#v", m)
	}
}

func TestRender(t *testing.T) {
	s, err := Render("Hello <NAME>", map[string]string{"name": "World"})
	if err != nil || s != "Hello World" {
		t.Fatalf("got %q %v", s, err)
	}
	_, err = Render("Hi <X>", map[string]string{})
	if err == nil {
		t.Fatal("expected error")
	}
}
