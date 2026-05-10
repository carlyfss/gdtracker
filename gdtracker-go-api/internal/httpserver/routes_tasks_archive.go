package httpserver

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/httpx"
)

func (s *Server) postTaskArchive(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.tasks == nil || s.archived == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	taskID := r.PathValue("id")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	ctx := r.Context()
	wantSummary := r.URL.Query().Get("includeSummary") == "true"

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer func() { _ = tx.Rollback() }()

	var trArchived, featArchived sql.NullTime
	var featID string
	err = tx.QueryRowContext(ctx, `
SELECT t.archived_at, f.archived_at, f.id
FROM tasks t
JOIN features f ON f.id = t.feature_id
WHERE t.id = $1 AND f.game_id = $2
FOR UPDATE OF t`,
		taskID, gameID,
	).Scan(&trArchived, &featArchived, &featID)
	if errors.Is(err, sql.ErrNoRows) {
		http.Error(w, "task not found", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("lock task archive: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if trArchived.Valid {
		if err := tx.Commit(); err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if wantSummary {
			httpx.WriteJSON(w, http.StatusOK, map[string]any{"branch": "noop_already_archived"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	now := time.Now().UTC()
	if err := s.tasks.SetArchivedWithTime(ctx, tx, taskID, now); err != nil {
		log.Printf("archive task: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	var af sql.NullString
	if featArchived.Valid {
		af = sql.NullString{String: featID, Valid: true}
	}
	if err := s.archived.UpsertArchivedTaskTx(ctx, tx, taskID, now, af); err != nil {
		log.Printf("archived_tasks upsert: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := tx.Commit(); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	log.Printf("archive_task game_id=%s task_id=%s feature_archived=%v", gameID, taskID, featArchived.Valid)
	if wantSummary {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"branch": "normal"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) postTaskUnarchive(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.tasks == nil || s.archived == nil || s.features == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	taskID := r.PathValue("id")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	ctx := r.Context()
	wantSummary := r.URL.Query().Get("includeSummary") == "true"

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer func() { _ = tx.Rollback() }()

	var trArchived sql.NullTime
	var featArchived sql.NullTime
	var featID, featName, featStatus, featColor string
	var featDesc sql.NullString
	var featParent sql.NullString
	err = tx.QueryRowContext(ctx, `
SELECT t.archived_at, f.archived_at, f.id, f.name, f.description, f.status, f.color, f.parent_feature_id
FROM tasks t
JOIN features f ON f.id = t.feature_id
WHERE t.id = $1 AND f.game_id = $2
FOR UPDATE OF t, f`,
		taskID, gameID,
	).Scan(&trArchived, &featArchived, &featID, &featName, &featDesc, &featStatus, &featColor, &featParent)
	if errors.Is(err, sql.ErrNoRows) {
		http.Error(w, "task not found", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("lock task unarchive: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if !trArchived.Valid {
		if err := tx.Commit(); err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if wantSummary {
			httpx.WriteJSON(w, http.StatusOK, map[string]any{"branch": "noop_not_archived"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}

	featureArchived := featArchived.Valid
	if !featureArchived {
		if err := s.tasks.ClearArchivedTx(ctx, tx, taskID); err != nil {
			log.Printf("unarchive task: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := s.archived.DeleteArchivedTaskTx(ctx, tx, taskID); err != nil {
			log.Printf("delete archived_task: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(); err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		log.Printf("unarchive_task branch=active_feature game_id=%s task_id=%s", gameID, taskID)
		if wantSummary {
			httpx.WriteJSON(w, http.StatusOK, map[string]any{"branch": "unarchive_to_active_feature"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}

	var restored sql.NullString
	if err := tx.QueryRowContext(ctx,
		`SELECT restored_feature_id FROM archived_features WHERE feature_id = $1`, featID,
	).Scan(&restored); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "archived feature metadata missing", http.StatusConflict)
			return
		}
		log.Printf("archived feature: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	var restoredID string
	if restored.Valid && restored.String != "" {
		restoredID = restored.String
	} else {
		baseName := featName + " (restored)"
		name, err := s.uniqueRestoredFeatureName(ctx, tx, gameID, nullParentPtr(featParent), baseName)
		if err != nil {
			log.Printf("unique feature name: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		desc := ""
		if featDesc.Valid {
			desc = featDesc.String
		}
		newID, err := s.archivedInsertFeatureCopyTx(ctx, tx, gameID, nullParentPtr(featParent), name, desc, featStatus, featColor)
		if err != nil {
			log.Printf("insert restored feature: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.ExecContext(ctx,
			`UPDATE archived_features SET restored_feature_id = $2 WHERE feature_id = $1`, featID, newID); err != nil {
			log.Printf("update archived_features: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		restoredID = newID
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE tasks SET feature_id = $2, archived = false, archived_at = NULL, updated_at = $3 WHERE id = $1`,
		taskID, restoredID, time.Now().UTC(),
	); err != nil {
		log.Printf("unarchive task update: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := s.archived.DeleteArchivedTaskTx(ctx, tx, taskID); err != nil {
		log.Printf("delete archived_task: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := tx.Commit(); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	log.Printf("unarchive_task branch=unarchive_to_restored game_id=%s task_id=%s restored_feature_id=%s", gameID, taskID, restoredID)
	if wantSummary {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"branch": "unarchive_to_restored", "restoredFeatureId": restoredID})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func nullParentPtr(p sql.NullString) *string {
	if !p.Valid {
		return nil
	}
	s := p.String
	return &s
}

func (s *Server) uniqueRestoredFeatureName(ctx context.Context, tx *sql.Tx, gameID string, parentID *string, base string) (string, error) {
	candidate := base
	n := 2
	for {
		var count int
		var err error
		if parentID == nil || *parentID == "" {
			err = tx.QueryRowContext(ctx,
				`SELECT COUNT(1) FROM features WHERE game_id = $1 AND parent_feature_id IS NULL AND LOWER(name) = LOWER($2)`,
				gameID, candidate,
			).Scan(&count)
		} else {
			err = tx.QueryRowContext(ctx,
				`SELECT COUNT(1) FROM features WHERE game_id = $1 AND parent_feature_id = $2 AND LOWER(name) = LOWER($3)`,
				gameID, *parentID, candidate,
			).Scan(&count)
		}
		if err != nil {
			return "", err
		}
		if count == 0 {
			return candidate, nil
		}
		candidate = fmt.Sprintf("%s (%d)", base, n)
		n++
	}
}

func (s *Server) archivedInsertFeatureCopyTx(ctx context.Context, tx *sql.Tx, gameID string, parentID *string, name, description, status, color string) (string, error) {
	var p sql.NullString
	if parentID != nil && *parentID != "" {
		p = sql.NullString{String: *parentID, Valid: true}
	}
	var id string
	err := tx.QueryRowContext(ctx, `
INSERT INTO features (id, game_id, name, description, status, color, archived, archived_at, parent_feature_id)
VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, false, NULL, $6)
RETURNING id`, gameID, name, description, status, color, p).Scan(&id)
	return id, err
}
