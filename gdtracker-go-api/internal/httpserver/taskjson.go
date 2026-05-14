package httpserver

import (
	"time"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/repository"
)

func featureToMap(f repository.Feature) map[string]any {
	m := map[string]any{
		"id":       f.ID,
		"name":     f.Name,
		"status":   f.Status,
		"color":    f.Color,
		"archived": f.Archived,
	}
	if f.Description.Valid {
		m["description"] = f.Description.String
	} else {
		m["description"] = nil
	}
	if f.ParentFeature.Valid {
		m["parentId"] = f.ParentFeature.String
	} else {
		m["parentId"] = nil
	}
	if f.ArchivedAt.Valid {
		m["archivedAt"] = f.ArchivedAt.Time.UTC().Format(time.RFC3339Nano)
	} else {
		m["archivedAt"] = nil
	}
	return m
}

func categoryToMap(c repository.Category) map[string]any {
	return map[string]any{
		"id":    c.ID,
		"name":  c.Name,
		"color": c.Color,
	}
}

func tagToMap(t repository.Tag) map[string]any {
	m := map[string]any{
		"id":    t.ID,
		"name":  t.Name,
		"color": t.Color,
	}
	if t.Description.Valid {
		m["description"] = t.Description.String
	} else {
		m["description"] = nil
	}
	return m
}

func taskRowToMap(tr repository.TaskListRow, tags []repository.Tag, cat *repository.Category, planningRefs []repository.TaskPlanningDocumentRef) map[string]any {
	m := map[string]any{
		"id":        tr.TaskID,
		"title":     tr.Title,
		"status":    tr.Status,
		"feature":   featureToMap(tr.Feature),
		"featureId": tr.Feature.ID,
		"archived":  tr.Archived,
		"createdAt": tr.CreatedAt.UTC().Format(time.RFC3339Nano),
		"updatedAt": tr.UpdatedAt.UTC().Format(time.RFC3339Nano),
	}
	if tr.Description.Valid {
		m["description"] = tr.Description.String
	} else {
		m["description"] = nil
	}
	if tr.CategoryID.Valid {
		m["categoryId"] = tr.CategoryID.String
	} else {
		m["categoryId"] = nil
	}
	if cat != nil {
		m["category"] = categoryToMap(*cat)
	}
	if tr.ParentTaskID.Valid {
		m["parentTaskId"] = tr.ParentTaskID.String
	} else {
		m["parentTaskId"] = nil
	}
	if tr.SourceGameExceptionID.Valid {
		m["sourceGameExceptionId"] = tr.SourceGameExceptionID.String
	} else {
		m["sourceGameExceptionId"] = nil
	}
	if tr.ArchivedAt.Valid {
		m["archivedAt"] = tr.ArchivedAt.Time.UTC().Format(time.RFC3339Nano)
	} else {
		m["archivedAt"] = nil
	}
	tagObjs := make([]map[string]any, 0, len(tags))
	tagIDs := make([]string, 0, len(tags))
	for _, t := range tags {
		tagObjs = append(tagObjs, tagToMap(t))
		tagIDs = append(tagIDs, t.ID)
	}
	m["tags"] = tagObjs
	m["tagIds"] = tagIDs
	refObjs := make([]map[string]any, 0, len(planningRefs))
	for _, r := range planningRefs {
		refObjs = append(refObjs, map[string]any{
			"id":   r.PlanningNodeID,
			"name": r.Name,
			"kind": r.Kind,
		})
	}
	m["planningDocumentRefs"] = refObjs
	return m
}
