package eventtemplate

import (
	"fmt"
	"regexp"
	"strings"
)

const (
	MaxTemplateLength = 100
	MaxOutputLength   = 100
)

var placeholder = regexp.MustCompile(`<([A-Z0-9_]+)>`)

// NormalizeKeys uppercases keys and maps '-' to '_' (Spring GameEventTemplateService parity).
func NormalizeKeys(raw map[string]string) map[string]string {
	if len(raw) == 0 {
		return map[string]string{}
	}
	out := make(map[string]string)
	for k, v := range raw {
		if strings.TrimSpace(k) == "" {
			continue
		}
		nk := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(k), "-", "_"))
		out[nk] = v
	}
	return out
}

// Render applies parameters to messageTemplate; errors use Spring message text.
func Render(messageTemplate string, parameters map[string]string) (string, error) {
	tpl := strings.TrimSpace(messageTemplate)
	if tpl == "" {
		return "", fmt.Errorf("message template is required")
	}
	if len(tpl) > MaxTemplateLength {
		return "", fmt.Errorf("message template exceeds %d characters", MaxTemplateLength)
	}
	normalized := NormalizeKeys(parameters)

	var b strings.Builder
	last := 0
	matches := placeholder.FindAllStringSubmatchIndex(tpl, -1)
	for _, m := range matches {
		if m[0] > last {
			b.WriteString(tpl[last:m[0]])
		}
		token := tpl[m[2]:m[3]]
		val, ok := normalized[token]
		if !ok {
			return "", fmt.Errorf("missing parameter for placeholder <%s> in template", token)
		}
		b.WriteString(val)
		last = m[1]
	}
	if last < len(tpl) {
		b.WriteString(tpl[last:])
	}
	rendered := b.String()
	if len(rendered) > MaxOutputLength {
		return "", fmt.Errorf("rendered message exceeds %d characters", MaxOutputLength)
	}
	return rendered, nil
}
