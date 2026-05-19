package httpserver

import (
	"context"
	"database/sql"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/repository"
)

const maxParentStatusSyncHops = 1000

// syncParentStatusesTx recomputes each ancestor's status from non-archived direct children (min workflow status).
func (s *Server) syncParentStatusesTx(ctx context.Context, tx *sql.Tx, gameID, startParentID string) error {
	if s.tasks == nil || startParentID == "" {
		return nil
	}
	parentID := startParentID
	for hops := 0; hops < maxParentStatusSyncHops; hops++ {
		statuses, err := s.tasks.ListActiveChildStatusesTx(ctx, tx, parentID)
		if err != nil {
			return err
		}
		if len(statuses) == 0 {
			break
		}
		want := minTaskStatus(statuses)
		if want == "" {
			break
		}
		current, err := s.tasks.FindStatusByIDAndGameTx(ctx, tx, parentID, gameID)
		if err != nil {
			return err
		}
		if current == "" {
			break
		}
		if want != current {
			if err := s.tasks.UpdateStatusTx(ctx, tx, parentID, want); err != nil {
				return err
			}
		}
		next, err := s.tasks.FindParentIDByIDTx(ctx, tx, parentID)
		if err != nil {
			return err
		}
		if next == nil || *next == "" {
			break
		}
		parentID = *next
	}
	return nil
}

func (s *Server) coerceTaskStatusFromActiveChildrenTx(ctx context.Context, tx *sql.Tx, taskID, requested string) (string, error) {
	statuses, err := s.tasks.ListActiveChildStatusesTx(ctx, tx, taskID)
	if err != nil {
		return "", err
	}
	if len(statuses) == 0 {
		return requested, nil
	}
	want := minTaskStatus(statuses)
	if want == "" {
		return requested, nil
	}
	return want, nil
}

func (s *Server) persistTaskCreate(ctx context.Context, gameID string, ins repository.TaskInsert) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if err := s.tasks.InsertTx(ctx, tx, ins); err != nil {
		return err
	}
	if ins.ParentTaskID.Valid {
		if err := s.syncParentStatusesTx(ctx, tx, gameID, ins.ParentTaskID.String); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Server) persistTaskUpdate(ctx context.Context, gameID string, u repository.TaskUpdate, oldParentID sql.NullString) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	coerced, err := s.coerceTaskStatusFromActiveChildrenTx(ctx, tx, u.ID, u.Status)
	if err != nil {
		return err
	}
	u.Status = coerced

	if err := s.tasks.UpdateTx(ctx, tx, u); err != nil {
		return err
	}

	parentsToSync := make([]string, 0, 2)
	if oldParentID.Valid && oldParentID.String != "" {
		parentsToSync = append(parentsToSync, oldParentID.String)
	}
	if u.ParentTaskID.Valid && u.ParentTaskID.String != "" {
		parentsToSync = appendUniqueParentID(parentsToSync, u.ParentTaskID.String)
	}
	for _, pid := range parentsToSync {
		if err := s.syncParentStatusesTx(ctx, tx, gameID, pid); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Server) persistTaskDelete(ctx context.Context, gameID, taskID string, parentID sql.NullString) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if err := s.tasks.DeleteByIDTx(ctx, tx, taskID); err != nil {
		return err
	}
	if parentID.Valid && parentID.String != "" {
		if err := s.syncParentStatusesTx(ctx, tx, gameID, parentID.String); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func appendUniqueParentID(ids []string, id string) []string {
	for _, existing := range ids {
		if existing == id {
			return ids
		}
	}
	return append(ids, id)
}
