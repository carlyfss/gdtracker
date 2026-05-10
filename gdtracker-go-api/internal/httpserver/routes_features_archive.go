package httpserver

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/httpx"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/repository"
)

func (s *Server) postFeatureArchive(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.features == nil || s.tasks == nil || s.archived == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	featureID := r.PathValue("id")
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

	if err := repository.LockFeatureForUpdate(ctx, tx, featureID, gameID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "feature not found", http.StatusNotFound)
			return
		}
		log.Printf("lock feature archive: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	var originalFeatureID string
	err = tx.QueryRowContext(ctx,
		`SELECT feature_id FROM archived_features WHERE restored_feature_id = $1`,
		featureID,
	).Scan(&originalFeatureID)
	if errors.Is(err, sql.ErrNoRows) {
		err = nil
		originalFeatureID = ""
	}
	if err != nil {
		log.Printf("archive mapping: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if originalFeatureID != "" {
		n, branch, err := s.mergeBackRestoredFeatureTx(ctx, tx, gameID, featureID, originalFeatureID)
		if err != nil {
			var he httpStatusErr
			if errors.As(err, &he) {
				http.Error(w, he.msg, he.code)
				return
			}
			log.Printf("merge back feature: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		log.Printf("archive_feature branch=merge_back game_id=%s restored_id=%s original_id=%s tasks_merged=%d", gameID, featureID, originalFeatureID, n)
		if err := tx.Commit(); err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if wantSummary {
			httpx.WriteJSON(w, http.StatusOK, map[string]any{"branch": branch, "tasksMerged": n})
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}

	root, err := s.features.FindByIDAndGame(ctx, featureID, gameID)
	if err != nil || root == nil {
		http.Error(w, "feature not found", http.StatusNotFound)
		return
	}
	if root.ArchivedAt.Valid {
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

	all, err := s.features.ListAllByGameOrderByNameAsc(ctx, gameID)
	if err != nil {
		log.Printf("list features: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	subtree := repository.CollectFeatureSubtreeIDs(all, featureID)
	now := time.Now().UTC()
	featureCount, taskCount := 0, 0
	for _, fid := range subtree {
		if err := s.features.SetArchivedStateTx(ctx, tx, fid, now, true); err != nil {
			log.Printf("archive feature row: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := s.archived.UpsertArchivedFeature(ctx, tx, fid, now, sql.NullString{}); err != nil {
			log.Printf("upsert archived_features: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		featureCount++
	}
	tasks, err := s.tasks.ListTaskIDsByFeatureIDsTx(ctx, tx, subtree)
	if err != nil {
		log.Printf("list tasks archive: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	for _, t := range tasks {
		if err := s.tasks.SetArchivedWithTime(ctx, tx, t.TaskID, now); err != nil {
			log.Printf("archive task: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		af := sql.NullString{String: t.FeatureID, Valid: true}
		if err := s.archived.UpsertArchivedTaskTx(ctx, tx, t.TaskID, now, af); err != nil {
			log.Printf("upsert archived_tasks: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		taskCount++
	}
	log.Printf("archive_feature branch=normal game_id=%s root_id=%s features=%d tasks=%d", gameID, featureID, featureCount, taskCount)
	if err := tx.Commit(); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if wantSummary {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{
			"branch":          "normal",
			"featuresTouched": featureCount,
			"tasksTouched":    taskCount,
		})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) mergeBackRestoredFeatureTx(ctx context.Context, tx *sql.Tx, gameID, restoredFeatureID, originalFeatureID string) (tasksMerged int, branch string, err error) {
	if err := repository.LockFeatureForUpdate(ctx, tx, originalFeatureID, gameID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, "", httpStatusErr{404, "feature not found"}
		}
		return 0, "", err
	}
	now := time.Now().UTC()
	tasks, err := s.tasks.ListTaskIDsByFeatureIDsTx(ctx, tx, []string{restoredFeatureID})
	if err != nil {
		return 0, "", err
	}
	for _, t := range tasks {
		if err := s.tasks.UpdateFeatureIDTx(ctx, tx, t.TaskID, originalFeatureID); err != nil {
			return 0, "", err
		}
		if err := s.tasks.SetArchivedWithTime(ctx, tx, t.TaskID, now); err != nil {
			return 0, "", err
		}
		af := sql.NullString{String: originalFeatureID, Valid: true}
		if err := s.archived.UpsertArchivedTaskTx(ctx, tx, t.TaskID, now, af); err != nil {
			return 0, "", err
		}
		tasksMerged++
	}
	if err := s.archived.ClearRestoredFeatureTx(ctx, tx, originalFeatureID); err != nil {
		return 0, "", err
	}
	if err := s.archived.DeleteFeatureByIDTx(ctx, tx, restoredFeatureID); err != nil {
		return 0, "", err
	}
	return tasksMerged, "merge_back", nil
}

func (s *Server) postFeatureUnarchive(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.features == nil || s.tasks == nil || s.archived == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	featureID := r.PathValue("id")
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

	if err := repository.LockFeatureForUpdate(ctx, tx, featureID, gameID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "feature not found", http.StatusNotFound)
			return
		}
		log.Printf("lock feature unarchive: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	root, err := s.features.FindByIDAndGame(ctx, featureID, gameID)
	if err != nil || root == nil {
		http.Error(w, "feature not found", http.StatusNotFound)
		return
	}
	if !root.ArchivedAt.Valid {
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

	all, err := s.features.ListAllByGameOrderByNameAsc(ctx, gameID)
	if err != nil {
		log.Printf("list features: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	subtree := repository.CollectFeatureSubtreeIDs(all, featureID)
	featureCount, taskCount := 0, 0
	for _, fid := range subtree {
		if err := s.features.SetArchivedStateTx(ctx, tx, fid, time.Time{}, false); err != nil {
			log.Printf("unarchive feature: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := s.archived.DeleteArchivedFeatureTx(ctx, tx, fid); err != nil {
			log.Printf("delete archived_features: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		featureCount++
	}
	tasks, err := s.tasks.ListTaskIDsByFeatureIDsTx(ctx, tx, subtree)
	if err != nil {
		log.Printf("list tasks unarchive: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	for _, t := range tasks {
		if err := s.tasks.ClearArchivedTx(ctx, tx, t.TaskID); err != nil {
			log.Printf("unarchive task: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := s.archived.DeleteArchivedTaskTx(ctx, tx, t.TaskID); err != nil {
			log.Printf("delete archived_task: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		taskCount++
	}
	log.Printf("unarchive_feature game_id=%s root_id=%s features=%d tasks=%d", gameID, featureID, featureCount, taskCount)
	if err := tx.Commit(); err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if wantSummary {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{
			"branch":          "unarchive_subtree",
			"featuresTouched": featureCount,
			"tasksTouched":    taskCount,
		})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
