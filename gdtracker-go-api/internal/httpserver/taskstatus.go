package httpserver

// allowedTaskStatuses matches gdtracker-api TaskStatus enum.
var allowedTaskStatuses = map[string]struct{}{
	"PENDING":     {},
	"TODO":        {},
	"IN_PROGRESS": {},
	"COMPLETED":   {},
	"DONE":        {},
}

// orderedTaskStatuses is workflow order (lowest to highest).
var orderedTaskStatuses = []string{
	"PENDING",
	"TODO",
	"IN_PROGRESS",
	"COMPLETED",
	"DONE",
}

func isValidTaskStatus(s string) bool {
	_, ok := allowedTaskStatuses[s]
	return ok
}

func taskStatusRank(s string) (int, bool) {
	for i, v := range orderedTaskStatuses {
		if v == s {
			return i, true
		}
	}
	return 0, false
}

// minTaskStatus returns the lowest workflow status among statuses, or "" if none are valid.
func minTaskStatus(statuses []string) string {
	best := -1
	for _, s := range statuses {
		r, ok := taskStatusRank(s)
		if !ok {
			continue
		}
		if best < 0 || r < best {
			best = r
		}
	}
	if best < 0 {
		return ""
	}
	return orderedTaskStatuses[best]
}
