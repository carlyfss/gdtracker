package httpserver

import (
	"net/url"
	"testing"
)

func TestParseTasksListPageQuery_defaults(t *testing.T) {
	t.Parallel()
	q := url.Values{}
	paged, p := parseTasksListPageQuery(q)
	if paged {
		t.Fatal("expected unpaged")
	}
	if p.Size != 25 || p.Page != 0 || !p.IncludeSubtasks {
		t.Fatalf("defaults: %+v", p)
	}
}

func TestParseTasksListPageQuery_paged(t *testing.T) {
	t.Parallel()
	q := url.Values{"size": {"50"}, "page": {"2"}, "includeSubtasks": {"false"}}
	q.Add("collapsedParentIds", "a")
	q.Add("collapsedParentIds", "b")
	paged, p := parseTasksListPageQuery(q)
	if !paged {
		t.Fatal("expected paged")
	}
	if p.Size != 50 || p.Page != 2 || p.IncludeSubtasks {
		t.Fatalf("params: %+v", p)
	}
	if len(p.CollapsedParentIDs) != 2 {
		t.Fatalf("collapsed: %+v", p.CollapsedParentIDs)
	}
}

func TestParseTasksListPageQuery_clampsSize(t *testing.T) {
	t.Parallel()
	q := url.Values{"size": {"500"}}
	_, p := parseTasksListPageQuery(q)
	if p.Size != 100 {
		t.Fatalf("size=%d", p.Size)
	}
}
