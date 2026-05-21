package httpserver

import (
	"net/url"
	"strconv"
	"strings"
)

type tasksListPageQuery struct {
	Page               int
	Size               int
	IncludeSubtasks    bool
	CollapsedParentIDs map[string]struct{}
}

func parseTasksListPageQuery(q url.Values) (paged bool, params tasksListPageQuery) {
	paged = q.Has("page") || q.Has("size")
	page, _ := strconv.Atoi(q.Get("page"))
	size, _ := strconv.Atoi(q.Get("size"))
	if size <= 0 {
		size = 25
	}
	if size > 100 {
		size = 100
	}
	if page < 0 {
		page = 0
	}
	includeSubtasks := true
	if v := strings.TrimSpace(q.Get("includeSubtasks")); v != "" {
		includeSubtasks = !strings.EqualFold(v, "false") && v != "0"
	}
	collapsed := make(map[string]struct{})
	for _, id := range q["collapsedParentIds"] {
		id = strings.TrimSpace(id)
		if id != "" {
			collapsed[id] = struct{}{}
		}
	}
	return paged, tasksListPageQuery{
		Page:               page,
		Size:               size,
		IncludeSubtasks:    includeSubtasks,
		CollapsedParentIDs: collapsed,
	}
}
