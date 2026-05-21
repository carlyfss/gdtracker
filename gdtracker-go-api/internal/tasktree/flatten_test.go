package tasktree

import (
	"testing"
	"time"
)

func node(id, title, parent string, created time.Time) Node {
	return Node{ID: id, Title: title, ParentTaskID: parent, CreatedAt: created}
}

func TestFlattenForList_rootsOnly(t *testing.T) {
	t.Parallel()
	t0 := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	t1 := t0.Add(time.Hour)
	nodes := []Node{
		node("a", "Alpha", "", t1),
		node("b", "Beta", "", t0),
	}
	rows := FlattenForList(nodes, FlattenOptions{ShowSubtasks: false})
	if len(rows) != 2 {
		t.Fatalf("got %d rows, want 2", len(rows))
	}
	if rows[0].Node.ID != "a" || rows[1].Node.ID != "b" {
		t.Fatalf("order: %+v", rows)
	}
	if rows[0].Depth != 0 || rows[1].Depth != 0 {
		t.Fatal("depth should be 0")
	}
}

func TestFlattenForList_withSubtasks(t *testing.T) {
	t.Parallel()
	t0 := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	nodes := []Node{
		node("p", "Parent", "", t0),
		node("c", "Child", "p", t0.Add(time.Hour)),
	}
	rows := FlattenForList(nodes, FlattenOptions{ShowSubtasks: true})
	if len(rows) != 2 {
		t.Fatalf("got %d rows, want 2", len(rows))
	}
	if rows[1].Depth != 1 || rows[1].Node.ID != "c" {
		t.Fatalf("child row: %+v", rows[1])
	}
	if !rows[0].HasChildren {
		t.Fatal("parent should have children")
	}
}

func TestFlattenForList_collapsedParent(t *testing.T) {
	t.Parallel()
	t0 := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	nodes := []Node{
		node("p", "Parent", "", t0),
		node("c", "Child", "p", t0),
	}
	collapsed := map[string]struct{}{"p": {}}
	rows := FlattenForList(nodes, FlattenOptions{ShowSubtasks: true, CollapsedParentIDs: collapsed})
	if len(rows) != 1 {
		t.Fatalf("got %d rows, want 1", len(rows))
	}
}

func TestFlattenForList_orphanSubtaskAsRoot(t *testing.T) {
	t.Parallel()
	t0 := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	// Parent not in filtered set — subtask appears as root (matches taskTree.ts).
	nodes := []Node{node("c", "Child", "missing-parent", t0)}
	rows := FlattenForList(nodes, FlattenOptions{ShowSubtasks: true})
	if len(rows) != 1 || rows[0].Node.ID != "c" {
		t.Fatalf("got %+v", rows)
	}
}

func TestPageSlice_boundaries(t *testing.T) {
	t.Parallel()
	t0 := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	var nodes []Node
	for i := 0; i < 5; i++ {
		nodes = append(nodes, node(string(rune('a'+i)), "T", "", t0))
	}
	flat := FlattenForList(nodes, FlattenOptions{ShowSubtasks: false})

	content, total, pages, num := PageSlice(flat, 0, 2)
	if len(content) != 2 || total != 5 || pages != 3 || num != 0 {
		t.Fatalf("page0: len=%d total=%d pages=%d num=%d", len(content), total, pages, num)
	}

	content, total, pages, num = PageSlice(flat, 2, 2)
	if len(content) != 1 || num != 2 {
		t.Fatalf("page2: %+v total=%d pages=%d", content, total, pages)
	}

	content, total, pages, num = PageSlice(nil, 0, 10)
	if content != nil || total != 0 || pages != 0 {
		t.Fatalf("empty: content=%v total=%d pages=%d", content, total, pages)
	}
}

func TestPageSlice_clampsSize(t *testing.T) {
	t.Parallel()
	rows := []DisplayRow{{Node: node("a", "A", "", time.Now())}}
	_, _, _, _ = PageSlice(rows, 0, 200)
	content, _, _, _ := PageSlice(rows, 0, 200)
	if len(content) != 1 {
		t.Fatal("expected one row")
	}
}
