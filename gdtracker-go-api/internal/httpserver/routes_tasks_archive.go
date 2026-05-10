package httpserver

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"
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
	tr, err := s.tasks.FindByIDAndGame(ctx, taskID, gameID)
	if err != nil || tr == nil {
		http.Error(w, "task not found", http.StatusNotFound)
		return
	}
	if tr.ArchivedAt.Valid {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	now := time.Now().UTC()
	if err := s.tasks.SetArchived(ctx, taskID, now); err != nil {
		log.Printf("archive task: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	var af sql.NullString
	if tr.Feature.ArchivedAt.Valid {
		af = sql.NullString{String: tr.Feature.ID, Valid: true}
	}
	if err := s.archived.UpsertArchivedTask(ctx, taskID, now, af); err != nil {
		log.Printf("archived_tasks upsert: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
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
	tr, err := s.tasks.FindByIDAndGame(ctx, taskID, gameID)
	if err != nil || tr == nil {
		http.Error(w, "task not found", http.StatusNotFound)
		return
	}
	if !tr.ArchivedAt.Valid {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	feat := tr.Feature
	featureArchived := feat.ArchivedAt.Valid

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer func() { _ = tx.Rollback() }()

	if !featureArchived {
		if _, err := tx.ExecContext(ctx, `UPDATE tasks SET archived = false, archived_at = NULL, updated_at = $2 WHERE id = $1`, taskID, time.Now().UTC()); err != nil {
			log.Printf("unarchive task: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM archived_tasks WHERE task_id = $1`, taskID); err != nil {
			log.Printf("delete archived_task: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := tx.Commit(); err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}

	var restored sql.NullString
	if err := tx.QueryRowContext(ctx,
		`SELECT restored_feature_id FROM archived_features WHERE feature_id = $1`, feat.ID,
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
		baseName := feat.Name + " (restored)"
		name, err := s.uniqueRestoredFeatureName(ctx, tx, gameID, nullParentPtr(feat.ParentFeature), baseName)
		if err != nil {
			log.Printf("unique feature name: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		desc := ""
		if feat.Description.Valid {
			desc = feat.Description.String
		}
		newID, err := s.archivedInsertFeatureCopyTx(ctx, tx, gameID, nullParentPtr(feat.ParentFeature), name, desc, feat.Status, feat.Color)
		if err != nil {
			log.Printf("insert restored feature: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if _, err := tx.ExecContext(ctx,
			`UPDATE archived_features SET restored_feature_id = $2 WHERE feature_id = $1`, feat.ID, newID); err != nil {
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
	if _, err := tx.ExecContext(ctx, `DELETE FROM archived_tasks WHERE task_id = $1`, taskID); err != nil {
		log.Printf("delete archived_task: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := tx.Commit(); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
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
