package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/httpx"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/repository"
)

const (
	defaultExceptionTitleTemplate       = "Fix Exception #<EXCEPTION_INDEX>"
	defaultExceptionDescriptionTemplate = "```\n<EXCEPTION_TRACE>\n```"
)

func (s *Server) registerConfigurationRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /games/{gameId}/configuration", s.getGameConfiguration)
	mux.HandleFunc("PATCH /games/{gameId}/configuration", s.patchGameConfiguration)
}

type exceptionTaskTemplatePatchBody struct {
	TitleTemplate       string  `json:"titleTemplate"`
	DescriptionTemplate string  `json:"descriptionTemplate"`
	DefaultCategoryID   *string `json:"defaultCategoryId"`
}

type gameConfigurationPatchBody struct {
	FeatureFlags          map[string]bool                 `json:"featureFlags"`
	Settings              map[string]any                  `json:"settings"`
	ExceptionTaskTemplate *exceptionTaskTemplatePatchBody `json:"exceptionTaskTemplate"`
}

func (s *Server) getGameConfiguration(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.gameConfig == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	ctx := r.Context()
	if err := repository.EnsureGameBootstrap(ctx, s.db, gameID); err != nil {
		log.Printf("ensure bootstrap: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	flags, settings, tplBytes, err := s.gameConfig.GetJSONColumns(ctx, gameID)
	if err != nil {
		log.Printf("get configuration: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out, err := s.buildGameConfigurationResponse(ctx, gameID, flags, settings, tplBytes)
	if err != nil {
		log.Printf("build configuration: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (s *Server) patchGameConfiguration(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.gameConfig == nil || s.categories == nil {
		s.noDB(w)
		return
	}
	gameID := r.PathValue("gameId")
	if _, ok := s.requireOwnedGame(w, r, gameID); !ok {
		return
	}
	var body gameConfigurationPatchBody
	if err := httpx.ReadJSON(r, &body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	if err := repository.EnsureGameBootstrap(ctx, s.db, gameID); err != nil {
		log.Printf("ensure bootstrap: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	_, _, curTpl, err := s.gameConfig.GetJSONColumns(ctx, gameID)
	if err != nil {
		log.Printf("get configuration: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	flagsOut := sanitizeFeatureFlagsMap(body.FeatureFlags)
	settingsOut := sanitizeSettingsMap(body.Settings)

	var tplBytes []byte
	if body.ExceptionTaskTemplate != nil {
		tpl, err := s.applyExceptionTemplatePatch(ctx, gameID, body.ExceptionTaskTemplate)
		if err != nil {
			var he httpStatusErr
			if errors.As(err, &he) {
				http.Error(w, he.msg, he.code)
				return
			}
			log.Printf("exception template: %v", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		tplBytes, err = json.Marshal(tpl)
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
	} else {
		tplBytes = curTpl
	}

	flagsJSON, err := json.Marshal(flagsOut)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	settingsJSON, err := json.Marshal(settingsOut)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := s.gameConfig.UpdateJSONColumns(ctx, gameID, flagsJSON, settingsJSON, tplBytes); err != nil {
		log.Printf("update configuration: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	out, err := s.buildGameConfigurationResponse(ctx, gameID, flagsJSON, settingsJSON, tplBytes)
	if err != nil {
		log.Printf("build configuration: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

type exceptionTplMap struct {
	TitleTemplate       string  `json:"titleTemplate"`
	DescriptionTemplate string  `json:"descriptionTemplate"`
	DefaultCategoryID   *string `json:"defaultCategoryId"`
}

func (s *Server) applyExceptionTemplatePatch(ctx context.Context, gameID string, p *exceptionTaskTemplatePatchBody) (exceptionTplMap, error) {
	title := strings.TrimSpace(p.TitleTemplate)
	if title == "" {
		title = defaultExceptionTitleTemplate
	}
	desc := p.DescriptionTemplate
	if strings.TrimSpace(desc) == "" {
		desc = defaultExceptionDescriptionTemplate
	}
	var catID *string
	if p.DefaultCategoryID != nil && strings.TrimSpace(*p.DefaultCategoryID) != "" {
		c := strings.TrimSpace(*p.DefaultCategoryID)
		row, err := s.categories.FindByIDAndGame(ctx, c, gameID)
		if err != nil || row == nil {
			return exceptionTplMap{}, httpStatusErr{400, "exceptionTaskTemplate.defaultCategoryId must reference a category"}
		}
		catID = &c
	}
	return exceptionTplMap{
		TitleTemplate:       title,
		DescriptionTemplate: desc,
		DefaultCategoryID:   catID,
	}, nil
}

func sanitizeFeatureFlagsMap(raw map[string]bool) map[string]bool {
	out := make(map[string]bool)
	if raw == nil {
		return out
	}
	for k, v := range raw {
		k = strings.TrimSpace(k)
		if k == "" {
			continue
		}
		out[k] = v
	}
	return out
}

func sanitizeSettingsMap(raw map[string]any) map[string]any {
	out := make(map[string]any)
	if raw == nil {
		return out
	}
	for k, v := range raw {
		k = strings.TrimSpace(k)
		if k == "" || v == nil {
			continue
		}
		switch v.(type) {
		case string, bool, float64, json.Number, int, int64, float32:
			out[k] = v
		default:
			// skip unsupported types like nested objects
		}
	}
	return out
}

func (s *Server) buildGameConfigurationResponse(ctx context.Context, gameID string, flagsJSON, settingsJSON, tplJSON []byte) (map[string]any, error) {
	var flags map[string]bool
	if len(flagsJSON) > 0 {
		if err := json.Unmarshal(flagsJSON, &flags); err != nil {
			return nil, err
		}
	}
	if flags == nil {
		flags = map[string]bool{}
	}
	var settings map[string]any
	if len(settingsJSON) > 0 {
		if err := json.Unmarshal(settingsJSON, &settings); err != nil {
			return nil, err
		}
	}
	if settings == nil {
		settings = map[string]any{}
	}
	settings = normalizeSettingsNumbers(settings)

	var rawTpl map[string]json.RawMessage
	if len(tplJSON) > 0 {
		if err := json.Unmarshal(tplJSON, &rawTpl); err != nil {
			return nil, err
		}
	}
	if rawTpl == nil {
		rawTpl = map[string]json.RawMessage{}
	}
	title := defaultExceptionTitleTemplate
	desc := defaultExceptionDescriptionTemplate
	var defCat *string
	if t, ok := rawTpl["titleTemplate"]; ok {
		var s string
		if json.Unmarshal(t, &s) == nil && strings.TrimSpace(s) != "" {
			title = strings.TrimSpace(s)
		}
	}
	if t, ok := rawTpl["descriptionTemplate"]; ok {
		var s string
		if json.Unmarshal(t, &s) == nil && strings.TrimSpace(s) != "" {
			desc = s
		}
	}
	if t, ok := rawTpl["defaultCategoryId"]; ok {
		var s string
		if err := json.Unmarshal(t, &s); err == nil && strings.TrimSpace(s) != "" {
			s = strings.TrimSpace(s)
			defCat = &s
		}
	}
	var defSummary any
	if defCat != nil {
		c, err := s.categories.FindByIDAndGame(ctx, *defCat, gameID)
		if err == nil && c != nil {
			defSummary = categoryToMap(*c)
		} else {
			defSummary = nil
		}
	} else {
		defSummary = nil
	}
	return map[string]any{
		"featureFlags": flags,
		"settings":     settings,
		"exceptionTaskTemplate": map[string]any{
			"titleTemplate":       title,
			"descriptionTemplate": desc,
			"defaultCategoryId":   nullStringPtr(defCat),
			"defaultCategory":     defSummary,
		},
	}, nil
}

func nullStringPtr(p *string) any {
	if p == nil {
		return nil
	}
	return *p
}

// JSON numbers unmarshal as float64; Spring/settings may expect int for whole numbers — keep as-is for TS compatibility.
func normalizeSettingsNumbers(m map[string]any) map[string]any {
	return m
}
