package httpserver

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/httpx"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/repository"
	"github.com/google/uuid"
)

func (s *Server) registerTaskRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /games/{gameId}/tasks", s.getTasks)
	mux.HandleFunc("POST /games/{gameId}/tasks", s.postTask)
	mux.HandleFunc("PUT /games/{gameId}/tasks/{id}", s.putTask)
	mux.HandleFunc("DELETE /games/{gameId}/tasks/{id}", s.deleteTask)
	mux.HandleFunc("POST /games/{gameId}/tasks/{id}/archive", s.postTaskArchive)
	mux.HandleFunc("POST /games/{gameId}/tasks/{id}/unarchive", s.postTaskUnarchive)
}

var wsCollapse = regexp.MustCompile(`\s+`)

type taskUpsertBody struct {
	Title                 string    `json:"title"`
	Description           *string   `json:"description"`
	Status                string    `json:"status"`
	FeatureID             string    `json:"featureId"`
	CategoryID            *string   `json:"categoryId"`
	TagIDs                *[]string `json:"tagIds"`
	ParentTaskID          *string   `json:"parentTaskId"`
	SourceGameExceptionID *string   `json:"sourceGameExceptionId"`
}

func normalizeTaskTitle(raw string) string {
	t := strings.TrimSpace(raw)
	if t == "" {
		return ""
	}
	return wsCollapse.ReplaceAllString(t, " ")
}

func sqlStringPtr(p *string) sql.NullString {
	if p == nil {
		return sql.NullString{}
	}
	t := strings.TrimSpace(*p)
	if t == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: t, Valid: true}
}

func (s *Server) getTasks(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.tasks == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	q := r.URL.Query()
	f := repository.TaskFilter{GameID: gameID, ArchivedOnly: q.Get("archivedOnly") == "true"}
	if v := strings.TrimSpace(q.Get("featureId")); v != "" {
		f.FeatureID = &v
	}
	if v := strings.TrimSpace(q.Get("status")); v != "" {
		f.Status = &v
	}
	if v := strings.TrimSpace(q.Get("categoryId")); v != "" {
		f.CategoryID = &v
	}
	if v := strings.TrimSpace(q.Get("sourceGameExceptionId")); v != "" {
		f.SourceGameExceptionID = &v
	}
	f.TagIDs = normalizeTagIDsQuery(q["tagIds"])
	if tm := strings.TrimSpace(q.Get("tagMode")); strings.EqualFold(tm, "ALL") {
		f.TagModeAll = true
	}
	ctx := r.Context()
	rows, err := s.tasks.ListFiltered(ctx, f)
	if err != nil {
		log.Printf("list tasks: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	taskIDs := make([]string, 0, len(rows))
	catIDs := make([]string, 0)
	seenCat := map[string]struct{}{}
	for _, tr := range rows {
		taskIDs = append(taskIDs, tr.TaskID)
		if tr.CategoryID.Valid {
			cid := tr.CategoryID.String
			if _, ok := seenCat[cid]; !ok {
				seenCat[cid] = struct{}{}
				catIDs = append(catIDs, cid)
			}
		}
	}
	tagMap, err := s.tasks.LoadTagsForTasks(ctx, taskIDs)
	if err != nil {
		log.Printf("load task tags: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	catMap, err := s.categories.MapByIDs(ctx, catIDs)
	if err != nil {
		log.Printf("load categories: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out := make([]map[string]any, 0, len(rows))
	for _, tr := range rows {
		tags := tagMap[tr.TaskID]
		var cat *repository.Category
		if tr.CategoryID.Valid {
			if c, ok := catMap[tr.CategoryID.String]; ok {
				cat = &c
			}
		}
		out = append(out, taskRowToMap(tr, tags, cat))
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func normalizeTagIDsQuery(raw []string) []string {
	if len(raw) == 0 {
		return nil
	}
	seen := make(map[string]struct{})
	var out []string
	for _, s := range raw {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		if strings.Contains(s, ",") {
			for _, part := range strings.Split(s, ",") {
				p := strings.TrimSpace(part)
				if p == "" {
					continue
				}
				if _, ok := seen[p]; !ok {
					seen[p] = struct{}{}
					out = append(out, p)
				}
			}
			continue
		}
		if _, ok := seen[s]; !ok {
			seen[s] = struct{}{}
			out = append(out, s)
		}
	}
	return out
}

func (s *Server) postTask(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.tasks == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	var body taskUpsertBody
	if err := httpx.ReadJSON(r, &body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if err := s.writeTaskCreate(w, r.Context(), gameID, body); err != nil {
		var he httpStatusErr
		if errors.As(err, &he) {
			http.Error(w, he.msg, he.code)
			return
		}
		log.Printf("create task: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
	}
}

func (s *Server) putTask(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.tasks == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	taskID := r.PathValue("id")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	var body taskUpsertBody
	if err := httpx.ReadJSON(r, &body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if err := s.writeTaskUpdate(w, r.Context(), gameID, taskID, body); err != nil {
		var he httpStatusErr
		if errors.As(err, &he) {
			http.Error(w, he.msg, he.code)
			return
		}
		log.Printf("update task: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
	}
}

func (s *Server) deleteTask(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.tasks == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	taskID := r.PathValue("id")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	ctx := r.Context()
	tr, err := s.tasks.FindByIDAndGame(ctx, taskID, gameID)
	if err != nil || tr == nil {
		http.Error(w, "task not found", http.StatusNotFound)
		return
	}
	_ = tr
	if err := s.tasks.DeleteByID(ctx, taskID); err != nil {
		log.Printf("delete task: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type httpStatusErr struct {
	code int
	msg  string
}

func (e httpStatusErr) Error() string { return e.msg }

func (s *Server) writeTaskCreate(w http.ResponseWriter, ctx context.Context, gameID string, body taskUpsertBody) error {
	title := normalizeTaskTitle(body.Title)
	if title == "" {
		return httpStatusErr{400, "title is required"}
	}
	if strings.TrimSpace(body.Status) == "" {
		return httpStatusErr{400, "status is required"}
	}
	featureID := strings.TrimSpace(body.FeatureID)
	if featureID == "" {
		return httpStatusErr{400, "featureId is required"}
	}
	feat, err := s.features.FindByIDAndGame(ctx, featureID, gameID)
	if err != nil || feat == nil {
		return httpStatusErr{400, "featureId is invalid"}
	}
	if feat.Archived || feat.ArchivedAt.Valid {
		return httpStatusErr{400, "featureId is invalid"}
	}
	catID, err := s.resolveCategoryID(ctx, gameID, body.CategoryID)
	if err != nil {
		return httpStatusErr{400, "categoryId is invalid"}
	}
	tagList := []string{}
	if body.TagIDs != nil {
		tagList = dedupeStrings(*body.TagIDs)
	}
	if err := s.validateTagIDs(ctx, gameID, tagList); err != nil {
		return httpStatusErr{400, "tagIds contain invalid tags"}
	}
	parentID, err := s.resolveParentTaskID(ctx, gameID, featureID, body.ParentTaskID, nil)
	if err != nil {
		var he httpStatusErr
		if errors.As(err, &he) {
			return he
		}
		return err
	}
	srcEx, err := s.resolveSourceExceptionID(ctx, gameID, body.SourceGameExceptionID, true)
	if err != nil {
		var he httpStatusErr
		if errors.As(err, &he) {
			return he
		}
		return err
	}
	ins := repository.TaskInsert{
		ID:                    uuid.NewString(),
		Title:                 title,
		Description:           sqlStringPtr(body.Description),
		Status:                body.Status,
		FeatureID:             featureID,
		CategoryID:            catID,
		ParentTaskID:          parentID,
		SourceGameExceptionID: srcEx,
		TagIDs:                tagList,
	}
	if err := s.tasks.Insert(ctx, ins); err != nil {
		return err
	}
	s.writeTaskResponse(w, ctx, gameID, ins.ID, http.StatusCreated)
	return nil
}

func (s *Server) writeTaskUpdate(w http.ResponseWriter, ctx context.Context, gameID, taskID string, body taskUpsertBody) error {
	existing, err := s.tasks.FindByIDAndGame(ctx, taskID, gameID)
	if err != nil || existing == nil {
		return httpStatusErr{404, "task not found"}
	}
	title := normalizeTaskTitle(body.Title)
	if title == "" {
		return httpStatusErr{400, "title is required"}
	}
	if strings.TrimSpace(body.Status) == "" {
		return httpStatusErr{400, "status is required"}
	}
	featureID := strings.TrimSpace(body.FeatureID)
	if featureID == "" {
		return httpStatusErr{400, "featureId is required"}
	}
	feat, err := s.features.FindByIDAndGame(ctx, featureID, gameID)
	if err != nil || feat == nil {
		return httpStatusErr{400, "featureId is invalid"}
	}
	if (feat.Archived || feat.ArchivedAt.Valid) && feat.ID != existing.Feature.ID {
		return httpStatusErr{400, "featureId is invalid"}
	}
	catID, err := s.resolveCategoryID(ctx, gameID, body.CategoryID)
	if err != nil {
		return httpStatusErr{400, "categoryId is invalid"}
	}
	var tagUpdate *[]string
	if body.TagIDs != nil {
		list := dedupeStrings(*body.TagIDs)
		if err := s.validateTagIDs(ctx, gameID, list); err != nil {
			return httpStatusErr{400, "tagIds contain invalid tags"}
		}
		tagUpdate = &list
	}
	parentID, err := s.resolveParentTaskID(ctx, gameID, featureID, body.ParentTaskID, &taskID)
	if err != nil {
		var he httpStatusErr
		if errors.As(err, &he) {
			return he
		}
		return err
	}
	srcEx := existing.SourceGameExceptionID
	if body.SourceGameExceptionID != nil {
		raw := strings.TrimSpace(*body.SourceGameExceptionID)
		if raw == "" {
			srcEx = sql.NullString{}
		} else {
			ex, err := s.gameExceptions.FindByIDAndGame(ctx, raw, gameID)
			if err != nil || ex == nil {
				return httpStatusErr{400, "sourceGameExceptionId must reference a game exception"}
			}
			srcEx = sql.NullString{String: raw, Valid: true}
		}
	}
	u := repository.TaskUpdate{
		ID:                    taskID,
		Title:                 title,
		Description:           sqlStringPtr(body.Description),
		Status:                body.Status,
		FeatureID:             featureID,
		CategoryID:            catID,
		ParentTaskID:          parentID,
		SourceGameExceptionID: srcEx,
		TagIDs:                tagUpdate,
	}
	if err := s.tasks.Update(ctx, u); err != nil {
		return err
	}
	s.writeTaskResponse(w, ctx, gameID, taskID, http.StatusOK)
	return nil
}

func (s *Server) writeTaskResponse(w http.ResponseWriter, ctx context.Context, gameID, taskID string, status int) {
	tr, err := s.tasks.FindByIDAndGame(ctx, taskID, gameID)
	if err != nil || tr == nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	tags, _ := s.tasks.LoadTagsForTasks(ctx, []string{taskID})
	var cat *repository.Category
	if tr.CategoryID.Valid {
		if m, e := s.categories.MapByIDs(ctx, []string{tr.CategoryID.String}); e == nil {
			if c, ok := m[tr.CategoryID.String]; ok {
				cat = &c
			}
		}
	}
	httpx.WriteJSON(w, status, taskRowToMap(*tr, tags[taskID], cat))
}

func dedupeStrings(in []string) []string {
	seen := make(map[string]struct{})
	var out []string
	for _, s := range in {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		if _, ok := seen[s]; !ok {
			seen[s] = struct{}{}
			out = append(out, s)
		}
	}
	return out
}

func (s *Server) resolveCategoryID(ctx context.Context, gameID string, raw *string) (sql.NullString, error) {
	if raw == nil {
		return sql.NullString{}, nil
	}
	cid := strings.TrimSpace(*raw)
	if cid == "" {
		return sql.NullString{}, nil
	}
	c, err := s.categories.FindByIDAndGame(ctx, cid, gameID)
	if err != nil || c == nil {
		return sql.NullString{}, fmt.Errorf("invalid")
	}
	return sql.NullString{String: c.ID, Valid: true}, nil
}

func (s *Server) validateTagIDs(ctx context.Context, gameID string, ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	found, err := s.tags.FindAllByIDsInGame(ctx, gameID, ids)
	if err != nil {
		return err
	}
	if len(found) != len(ids) {
		return fmt.Errorf("invalid tags")
	}
	return nil
}

func (s *Server) resolveParentTaskID(ctx context.Context, gameID, featureID string, raw *string, taskIDBeingUpdated *string) (sql.NullString, error) {
	if raw == nil {
		return sql.NullString{}, nil
	}
	pid := strings.TrimSpace(*raw)
	if pid == "" {
		return sql.NullString{}, nil
	}
	parent, err := s.tasks.FindByIDAndGame(ctx, pid, gameID)
	if err != nil || parent == nil {
		return sql.NullString{}, httpStatusErr{400, "parentTaskId is invalid"}
	}
	if parent.Feature.ID != featureID {
		return sql.NullString{}, httpStatusErr{400, "parentTaskId must reference a task on the same feature"}
	}
	if taskIDBeingUpdated != nil {
		if pid == *taskIDBeingUpdated {
			return sql.NullString{}, httpStatusErr{400, "task cannot be its own parent"}
		}
		if err := s.assertNoParentCycle(ctx, pid, *taskIDBeingUpdated); err != nil {
			return sql.NullString{}, err
		}
	}
	return sql.NullString{String: pid, Valid: true}, nil
}

func (s *Server) assertNoParentCycle(ctx context.Context, parentID, taskID string) error {
	walk := parentID
	for hops := 0; hops < 1000; hops++ {
		if walk == taskID {
			return httpStatusErr{400, "parentTaskId would create a cycle"}
		}
		next, err := s.tasks.FindParentIDByID(ctx, walk)
		if err != nil {
			return err
		}
		if next == nil {
			return nil
		}
		walk = *next
	}
	return httpStatusErr{400, "parentTaskId would create a cycle"}
}

func (s *Server) resolveSourceExceptionID(ctx context.Context, gameID string, raw *string, _ bool) (sql.NullString, error) {
	if raw == nil {
		return sql.NullString{}, nil
	}
	v := strings.TrimSpace(*raw)
	if v == "" {
		return sql.NullString{}, nil
	}
	ex, err := s.gameExceptions.FindByIDAndGame(ctx, v, gameID)
	if err != nil || ex == nil {
		return sql.NullString{}, httpStatusErr{400, "sourceGameExceptionId must reference a game exception"}
	}
	return sql.NullString{String: v, Valid: true}, nil
}
