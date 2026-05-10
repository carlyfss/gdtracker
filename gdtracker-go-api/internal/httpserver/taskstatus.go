package httpserver

// allowedTaskStatuses matches gdtracker-api TaskStatus enum.
var allowedTaskStatuses = map[string]struct{}{
	"PENDING":     {},
	"TODO":        {},
	"IN_PROGRESS": {},
	"COMPLETED":   {},
	"DONE":        {},
}

func isValidTaskStatus(s string) bool {
	_, ok := allowedTaskStatuses[s]
	return ok
}
