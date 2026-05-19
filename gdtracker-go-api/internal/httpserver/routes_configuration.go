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
	TitleTemplate            string            `json:"titleTemplate"`
	DescriptionTemplate      string            `json:"descriptionTemplate"`
	DefaultCategoryID        *string           `json:"defaultCategoryId"`
	ExamplePlaceholderValues map[string]string `json:"examplePlaceholderValues"`
}

type gameConfigurationPatchRaw struct {
	FeatureFlags          json.RawMessage `json:"featureFlags"`
	Settings              json.RawMessage `json:"settings"`
	ExceptionTaskTemplate json.RawMessage `json:"exceptionTaskTemplate"`
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
	var rawPatch gameConfigurationPatchRaw
	if err := httpx.ReadJSON(r, &rawPatch); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	if err := repository.EnsureGameBootstrap(ctx, s.db, gameID); err != nil {
		log.Printf("ensure bootstrap: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	curFlags, curSettings, curTpl, err := s.gameConfig.GetJSONColumns(ctx, gameID)
	if err != nil {
		log.Printf("get configuration: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	flagsJSON := curFlags
	if len(rawPatch.FeatureFlags) > 0 {
		var flags map[string]bool
		if err := json.Unmarshal(rawPatch.FeatureFlags, &flags); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		flagsJSON, err = json.Marshal(sanitizeFeatureFlagsMap(flags))
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
	}

	settingsJSON := curSettings
	if len(rawPatch.Settings) > 0 {
		var settings map[string]any
		if err := json.Unmarshal(rawPatch.Settings, &settings); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		settingsJSON, err = json.Marshal(sanitizeSettingsMap(settings))
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
	}

	tplBytes := curTpl
	if len(rawPatch.ExceptionTaskTemplate) > 0 {
		var p exceptionTaskTemplatePatchBody
		if err := json.Unmarshal(rawPatch.ExceptionTaskTemplate, &p); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		tpl, err := s.applyExceptionTemplatePatch(ctx, gameID, &p, curTpl)
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
	TitleTemplate            string            `json:"titleTemplate"`
	DescriptionTemplate      string            `json:"descriptionTemplate"`
	DefaultCategoryID        *string           `json:"defaultCategoryId"`
	ExamplePlaceholderValues map[string]string `json:"examplePlaceholderValues"`
}

func (s *Server) applyExceptionTemplatePatch(
	ctx context.Context,
	gameID string,
	p *exceptionTaskTemplatePatchBody,
	curTplJSON []byte,
) (exceptionTplMap, error) {
	var cur exceptionTplMap
	if len(curTplJSON) > 0 {
		_ = json.Unmarshal(curTplJSON, &cur)
	}
	if cur.ExamplePlaceholderValues == nil {
		cur.ExamplePlaceholderValues = map[string]string{}
	}

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

	examples := cur.ExamplePlaceholderValues
	if p.ExamplePlaceholderValues != nil {
		examples = sanitizeExamplePlaceholderMap(p.ExamplePlaceholderValues)
	}

	return exceptionTplMap{
		TitleTemplate:            title,
		DescriptionTemplate:      desc,
		DefaultCategoryID:        catID,
		ExamplePlaceholderValues: examples,
	}, nil
}

func sanitizeExamplePlaceholderMap(raw map[string]string) map[string]string {
	out := make(map[string]string)
	if raw == nil {
		return out
	}
	for k, v := range raw {
		k = strings.TrimSpace(k)
		v = strings.TrimSpace(v)
		if k == "" || v == "" {
			continue
		}
		out[k] = v
	}
	return out
}

func parseExamplePlaceholderValuesFromTpl(rawTpl map[string]json.RawMessage) map[string]string {
	out := map[string]string{}
	if rawTpl == nil {
		return out
	}
	t, ok := rawTpl["examplePlaceholderValues"]
	if !ok || len(t) == 0 {
		return out
	}
	var m map[string]string
	if err := json.Unmarshal(t, &m); err != nil {
		return out
	}
	return sanitizeExamplePlaceholderMap(m)
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
	examples := parseExamplePlaceholderValuesFromTpl(rawTpl)
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
			"titleTemplate":            title,
			"descriptionTemplate":      desc,
			"defaultCategoryId":        nullStringPtr(defCat),
			"defaultCategory":          defSummary,
			"examplePlaceholderValues": examples,
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
