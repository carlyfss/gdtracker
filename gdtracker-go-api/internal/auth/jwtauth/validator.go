package jwtauth

import (
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Config for Auth0 JWT validation.
type Config struct {
	Domain   string
	Audience string
}

// Validator validates Auth0 access tokens using JWKS.
type Validator struct {
	issuer   string
	audience string
	jwksURL  string
	client   *http.Client

	mu        sync.RWMutex
	keys      map[string]crypto.PublicKey
	fetchedAt time.Time
	ttl       time.Duration
}

// NewValidator builds an Auth0 JWT validator.
func NewValidator(cfg Config) (*Validator, error) {
	domain := strings.TrimSpace(cfg.Domain)
	audience := strings.TrimSpace(cfg.Audience)
	if domain == "" {
		return nil, fmt.Errorf("AUTH0_DOMAIN is required in auth0 mode")
	}
	if audience == "" {
		return nil, fmt.Errorf("AUTH0_AUDIENCE is required in auth0 mode")
	}
	domain = strings.TrimPrefix(domain, "https://")
	domain = strings.TrimPrefix(domain, "http://")
	domain = strings.TrimSuffix(domain, "/")

	return &Validator{
		issuer:   "https://" + domain + "/",
		audience: audience,
		jwksURL:  "https://" + domain + "/.well-known/jwks.json",
		client:   &http.Client{Timeout: 10 * time.Second},
		keys:     make(map[string]crypto.PublicKey),
		ttl:      time.Hour,
	}, nil
}

// Validate parses and validates a Bearer access token.
func (v *Validator) Validate(ctx context.Context, rawToken string) (*Claims, error) {
	rawToken = strings.TrimSpace(rawToken)
	if rawToken == "" {
		return nil, fmt.Errorf("missing token")
	}

	keyFunc := func(t *jwt.Token) (any, error) {
		kid, _ := t.Header["kid"].(string)
		if kid == "" {
			return nil, fmt.Errorf("token missing kid header")
		}
		return v.publicKey(ctx, kid)
	}

	parsed, err := jwt.Parse(rawToken, keyFunc,
		jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg(), jwt.SigningMethodES256.Alg()}),
		jwt.WithIssuer(v.issuer),
		jwt.WithAudience(v.audience),
	)
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}
	if !parsed.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	mapClaims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("unexpected claims type")
	}

	sub, _ := mapClaims["sub"].(string)
	if sub == "" {
		return nil, fmt.Errorf("token missing sub claim")
	}

	username := firstStringClaim(mapClaims,
		"preferred_username",
		"nickname",
		"username",
		"name",
	)

	gdtrackerUserID := firstStringClaim(mapClaims,
		customClaimGDTrackerUserID,
		"gdtracker_user_id",
	)

	return &Claims{
		Sub:             sub,
		Username:        username,
		GDTrackerUserID: gdtrackerUserID,
	}, nil
}

func firstStringClaim(claims jwt.MapClaims, keys ...string) string {
	for _, k := range keys {
		if v, ok := claims[k].(string); ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func (v *Validator) publicKey(ctx context.Context, kid string) (crypto.PublicKey, error) {
	v.mu.RLock()
	key, ok := v.keys[kid]
	stale := time.Since(v.fetchedAt) > v.ttl
	v.mu.RUnlock()
	if ok && !stale {
		return key, nil
	}
	if err := v.refreshJWKS(ctx); err != nil {
		return nil, err
	}
	v.mu.RLock()
	defer v.mu.RUnlock()
	key, ok = v.keys[kid]
	if !ok {
		return nil, fmt.Errorf("unknown signing key kid=%q", kid)
	}
	return key, nil
}

type jwksDocument struct {
	Keys []jwkKey `json:"keys"`
}

type jwkKey struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Use string `json:"use"`
	N   string `json:"n"`
	E   string `json:"e"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

func (v *Validator) refreshJWKS(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.jwksURL, nil)
	if err != nil {
		return err
	}
	res, err := v.client.Do(req)
	if err != nil {
		return fmt.Errorf("fetch jwks: %w", err)
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("fetch jwks: status %d", res.StatusCode)
	}

	var doc jwksDocument
	if err := json.NewDecoder(res.Body).Decode(&doc); err != nil {
		return fmt.Errorf("decode jwks: %w", err)
	}

	keys := make(map[string]crypto.PublicKey, len(doc.Keys))
	for _, k := range doc.Keys {
		if k.Kid == "" {
			continue
		}
		if k.Use != "" && k.Use != "sig" {
			continue
		}
		pub, err := jwkToPublicKey(k)
		if err != nil {
			continue
		}
		keys[k.Kid] = pub
	}
	if len(keys) == 0 {
		return fmt.Errorf("jwks contained no usable signing keys")
	}

	v.mu.Lock()
	v.keys = keys
	v.fetchedAt = time.Now()
	v.mu.Unlock()
	return nil
}

func jwkToPublicKey(k jwkKey) (crypto.PublicKey, error) {
	switch k.Kty {
	case "RSA":
		return rsaPublicKey(k.N, k.E)
	case "EC":
		return ecPublicKey(k.Crv, k.X, k.Y)
	default:
		return nil, fmt.Errorf("unsupported kty %q", k.Kty)
	}
}

func rsaPublicKey(nB64, eB64 string) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(nB64)
	if err != nil {
		return nil, err
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(eB64)
	if err != nil {
		return nil, err
	}
	n := new(big.Int).SetBytes(nBytes)
	e := 0
	for _, b := range eBytes {
		e = e<<8 + int(b)
	}
	return &rsa.PublicKey{N: n, E: e}, nil
}

func ecPublicKey(crv, xB64, yB64 string) (*ecdsa.PublicKey, error) {
	var curve elliptic.Curve
	switch crv {
	case "P-256":
		curve = elliptic.P256()
	case "P-384":
		curve = elliptic.P384()
	case "P-521":
		curve = elliptic.P521()
	default:
		return nil, fmt.Errorf("unsupported crv %q", crv)
	}
	xBytes, err := base64.RawURLEncoding.DecodeString(xB64)
	if err != nil {
		return nil, err
	}
	yBytes, err := base64.RawURLEncoding.DecodeString(yB64)
	if err != nil {
		return nil, err
	}
	x := new(big.Int).SetBytes(xBytes)
	y := new(big.Int).SetBytes(yBytes)
	return &ecdsa.PublicKey{Curve: curve, X: x, Y: y}, nil
}
