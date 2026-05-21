// Package tasktree flattens task trees for list UIs.
// Keep in sync with gdtracker-web/src/util/taskTree.ts (flattenTasksForList).
package tasktree

import (
	"sort"
	"strings"
	"time"
)

// Node is the minimal task shape required for tree flattening.
type Node struct {
	ID           string
	Title        string
	ParentTaskID string // empty means root (no parent)
	CreatedAt    time.Time
}

// DisplayRow is one flattened list row.
type DisplayRow struct {
	Node        Node
	Depth       int
	HasChildren bool
}

// FlattenOptions controls flatten behavior (mirrors taskTree.ts).
type FlattenOptions struct {
	ShowSubtasks       bool
	CollapsedParentIDs map[string]struct{}
}

func taskCreatedMs(n Node) int64 {
	if n.CreatedAt.IsZero() {
		return 0
	}
	return n.CreatedAt.UnixMilli()
}

func compareTreeOrder(a, b Node) int {
	tb := taskCreatedMs(b) - taskCreatedMs(a)
	if tb != 0 {
		if tb > 0 {
			return 1
		}
		return -1
	}
	return strings.Compare(a.Title, b.Title)
}

func childrenByParentID(nodes []Node) map[string][]Node {
	m := make(map[string][]Node)
	for _, n := range nodes {
		k := ""
		if pid := strings.TrimSpace(n.ParentTaskID); pid != "" {
			k = pid
		}
		m[k] = append(m[k], n)
	}
	for k := range m {
		sort.Slice(m[k], func(i, j int) bool {
			return compareTreeOrder(m[k][i], m[k][j]) < 0
		})
	}
	return m
}

// FlattenForList returns tasks in tree order for the list UI.
func FlattenForList(nodes []Node, opts FlattenOptions) []DisplayRow {
	byParent := childrenByParentID(nodes)
	byID := make(map[string]Node, len(nodes))
	for _, n := range nodes {
		byID[n.ID] = n
	}

	hasChildren := func(id string) bool {
		return len(byParent[id]) > 0
	}

	var out []DisplayRow
	collapsed := opts.CollapsedParentIDs
	if collapsed == nil {
		collapsed = map[string]struct{}{}
	}

	var walk func(node Node, depth int)
	walk = func(node Node, depth int) {
		hc := hasChildren(node.ID)
		out = append(out, DisplayRow{Node: node, Depth: depth, HasChildren: hc})
		if !opts.ShowSubtasks {
			return
		}
		if hc {
			if _, ok := collapsed[node.ID]; ok {
				return
			}
			for _, k := range byParent[node.ID] {
				walk(k, depth+1)
			}
		}
	}

	var roots []Node
	for _, n := range nodes {
		raw := strings.TrimSpace(n.ParentTaskID)
		if raw == "" {
			roots = append(roots, n)
			continue
		}
		if _, ok := byID[raw]; !ok {
			roots = append(roots, n)
		}
	}
	sort.Slice(roots, func(i, j int) bool {
		return compareTreeOrder(roots[i], roots[j]) < 0
	})
	for _, r := range roots {
		walk(r, 0)
	}
	return out
}

// PageSlice returns a page of rows and page metadata (0-based page).
func PageSlice(rows []DisplayRow, page, size int) (content []DisplayRow, totalElements, totalPages, number int) {
	if size <= 0 {
		size = 25
	}
	if size > 100 {
		size = 100
	}
	if page < 0 {
		page = 0
	}
	totalElements = len(rows)
	if totalElements == 0 {
		return nil, 0, 0, 0
	}
	totalPages = (totalElements + size - 1) / size
	if page >= totalPages {
		page = totalPages - 1
	}
	number = page
	start := page * size
	end := start + size
	if end > totalElements {
		end = totalElements
	}
	return rows[start:end], totalElements, totalPages, number
}
