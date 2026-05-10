package gameeventimage

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"regexp"
	"strings"
)

const (
	maxIconSize   = 16
	maxImageBytes = 48 * 1024
)

var dataURL = regexp.MustCompile(`(?i)^data:image/[^;]+;base64,(.+)$`)

// ValidateOptionalImageData mirrors GameEventImageService (16x16 max, 48KiB).
func ValidateOptionalImageData(imageData *string) error {
	if imageData == nil {
		return nil
	}
	s := strings.TrimSpace(*imageData)
	if s == "" {
		return nil
	}
	if len(s) > maxImageBytes {
		return fmt.Errorf("image data is too large")
	}
	base64Part := s
	if m := dataURL.FindStringSubmatch(s); m != nil {
		base64Part = strings.ReplaceAll(m[1], " ", "")
		base64Part = strings.ReplaceAll(base64Part, "\n", "")
		base64Part = strings.ReplaceAll(base64Part, "\r", "")
	}
	raw, err := base64.StdEncoding.DecodeString(base64Part)
	if err != nil {
		return fmt.Errorf("image data is not valid base64")
	}
	if len(raw) > maxImageBytes {
		return fmt.Errorf("image data is too large")
	}
	img, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return fmt.Errorf("could not read image")
	}
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	if w > maxIconSize || h > maxIconSize {
		return fmt.Errorf("image must be at most %dx%d pixels", maxIconSize, maxIconSize)
	}
	return nil
}
