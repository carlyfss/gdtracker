package httpserver

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/auth"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/auth/jwtauth"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/httpx"
	"github.com/carlyfss/gdtracker/gdtracker-go-api/internal/repository"
	"github.com/google/uuid"
	"github.com/gorilla/sessions"
	"github.com/lib/pq"
)

const sessionCookieName = "JSESSIONID"

// Server wires auth routes and shared session / CSRF cookie settings.
type Server struct {
	db                   *sql.DB
	users                *repository.UserRepository
	games                *repository.GameRepository
	categories           *repository.CategoryRepository
	tags                 *repository.TagRepository
	features             *repository.FeatureRepository
	tasks                *repository.TaskRepository
	taskRefs             *repository.TaskRefsRepository
	gameExceptions       *repository.GameExceptionRepository
	gamePlayers          *repository.GamePlayerRepository
	archived             *repository.ArchivedRepository
	gameConfig           *repository.GameConfigurationRepository
	gameEventDefinitions *repository.GameEventDefinitionRepository
	gameEvents           *repository.GameEventRepository
	gameTraces           *repository.GameEventTraceRepository
	feedbackMeters       *repository.GameFeedbackMeterDefinitionRepository
	feedbacks            *repository.GameFeedbackRepository
	planning             *repository.PlanningRepository
	store                *sessions.CookieStore
	jwtValidator         *jwtauth.Validator
	authMode             AuthMode
	cookieDomain         string
	cookieSecure         bool
}

// Config for New.
type Config struct {
	AuthMode      AuthMode
	SessionSecret string
	Auth0Domain   string
	Auth0Audience string
	DB            *sql.DB
	CookieDomain  string
	CookieSecure  bool
}

// New builds a Server.
func New(cfg Config) (*Server, error) {
	if cfg.AuthMode == "" {
		cfg.AuthMode = AuthModeSession
	}

	var (
		st           *sessions.CookieStore
		jwtValidator *jwtauth.Validator
		err          error
	)

	switch cfg.AuthMode {
	case AuthModeAuth0:
		jwtValidator, err = jwtauth.NewValidator(jwtauth.Config{
			Domain:   cfg.Auth0Domain,
			Audience: cfg.Auth0Audience,
		})
		if err != nil {
			return nil, err
		}
	case AuthModeSession:
		if strings.TrimSpace(cfg.SessionSecret) == "" {
			return nil, fmt.Errorf("GDTRACKER_SESSION_SECRET is required in session mode")
		}
		st, err = newSessionStore(cfg.SessionSecret, cfg.CookieDomain, cfg.CookieSecure)
		if err != nil {
			return nil, err
		}
	default:
		return nil, fmt.Errorf("unsupported AUTH_MODE %q", cfg.AuthMode)
	}
	var (
		users                *repository.UserRepository
		games                *repository.GameRepository
		categories           *repository.CategoryRepository
		tags                 *repository.TagRepository
		features             *repository.FeatureRepository
		tasks                *repository.TaskRepository
		taskRefs             *repository.TaskRefsRepository
		gameExceptions       *repository.GameExceptionRepository
		gamePlayers          *repository.GamePlayerRepository
		archived             *repository.ArchivedRepository
		gameConfig           *repository.GameConfigurationRepository
		gameEventDefinitions *repository.GameEventDefinitionRepository
		gameEvents           *repository.GameEventRepository
		gameTraces           *repository.GameEventTraceRepository
		feedbackMeters       *repository.GameFeedbackMeterDefinitionRepository
		feedbacks            *repository.GameFeedbackRepository
		planning             *repository.PlanningRepository
	)
	if cfg.DB != nil {
		users = repository.NewUserRepository(cfg.DB)
		games = repository.NewGameRepository(cfg.DB)
		categories = repository.NewCategoryRepository(cfg.DB)
		tags = repository.NewTagRepository(cfg.DB)
		features = repository.NewFeatureRepository(cfg.DB)
		tasks = repository.NewTaskRepository(cfg.DB)
		taskRefs = repository.NewTaskRefsRepository(cfg.DB)
		gameExceptions = repository.NewGameExceptionRepository(cfg.DB)
		gamePlayers = repository.NewGamePlayerRepository(cfg.DB)
		archived = repository.NewArchivedRepository(cfg.DB)
		gameConfig = repository.NewGameConfigurationRepository(cfg.DB)
		gameEventDefinitions = repository.NewGameEventDefinitionRepository(cfg.DB)
		gameEvents = repository.NewGameEventRepository(cfg.DB)
		gameTraces = repository.NewGameEventTraceRepository(cfg.DB)
		feedbackMeters = repository.NewGameFeedbackMeterDefinitionRepository(cfg.DB)
		feedbacks = repository.NewGameFeedbackRepository(cfg.DB)
		planning = repository.NewPlanningRepository(cfg.DB)
	}
	return &Server{
		db:                   cfg.DB,
		users:                users,
		games:                games,
		categories:           categories,
		tags:                 tags,
		features:             features,
		tasks:                tasks,
		taskRefs:             taskRefs,
		gameExceptions:       gameExceptions,
		gamePlayers:          gamePlayers,
		archived:             archived,
		gameConfig:           gameConfig,
		gameEventDefinitions: gameEventDefinitions,
		gameEvents:           gameEvents,
		gameTraces:           gameTraces,
		feedbackMeters:       feedbackMeters,
		feedbacks:            feedbacks,
		planning:             planning,
		store:                st,
		jwtValidator:         jwtValidator,
		authMode:             cfg.AuthMode,
		cookieDomain:         cfg.CookieDomain,
		cookieSecure:         cfg.CookieSecure,
	}, nil
}

// APIHandler returns the /api subtree (mount at "/api/").
func (s *Server) APIHandler(corsEnv string) http.Handler {
	mux := http.NewServeMux()
	if s.authMode == AuthModeSession {
		mux.HandleFunc("GET /csrf", s.getCSRF)
		mux.HandleFunc("POST /auth/register", s.postRegister)
		mux.HandleFunc("POST /auth/login", s.postLogin)
		mux.HandleFunc("POST /auth/logout", s.postLogout)
	}
	mux.HandleFunc("GET /auth/me", s.getMe)

	s.registerGameRoutes(mux)
	s.registerCategoryRoutes(mux)
	s.registerTagRoutes(mux)
	s.registerTaskRoutes(mux)
	s.registerFeatureRoutes(mux)
	s.registerConfigurationRoutes(mux)
	s.registerExceptionRoutes(mux)
	s.registerIngestPlaneRoutes(mux)
	s.registerGameEventRoutes(mux)
	s.registerTraceRoutes(mux)
	s.registerFeedbackRoutes(mux)
	s.registerPlanningRoutes(mux)

	strip := http.StripPrefix("/api", mux)
	h := CorsMiddleware(corsEnv)(strip)
	rlCfg := loadRateLimitConfig()
	h = RateLimitMiddleware(s, rlCfg)(h)
	if s.authMode == AuthModeSession {
		h = CsrfMiddleware(s.cookieDomain, s.cookieSecure)(h)
	}
	return h
}

func (s *Server) noDB(w http.ResponseWriter) {
	httpx.WriteJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "database not configured"})
}

func (s *Server) sessionUser(r *http.Request) (userID, username string, ok bool) {
	sess, err := s.store.Get(r, sessionCookieName)
	if err != nil {
		return "", "", false
	}
	uid, uok := sess.Values["userId"].(string)
	name, nok := sess.Values["username"].(string)
	if !uok || !nok || uid == "" || name == "" {
		return "", "", false
	}
	return uid, name, true
}

func (s *Server) saveSession(w http.ResponseWriter, r *http.Request, userID, username string) error {
	sess, err := s.store.Get(r, sessionCookieName)
	if err != nil {
		return err
	}
	sess.Values["userId"] = userID
	sess.Values["username"] = username
	return sess.Save(r, w)
}

func (s *Server) clearSession(w http.ResponseWriter, r *http.Request) error {
	sess, err := s.store.Get(r, sessionCookieName)
	if err != nil {
		return err
	}
	sess.Options.MaxAge = -1
	for k := range sess.Values {
		delete(sess.Values, k)
	}
	return sess.Save(r, w)
}

func (s *Server) issueCSRF(w http.ResponseWriter) error {
	tok, err := newCSRFToken()
	if err != nil {
		return err
	}
	writeCSRFCookie(w, tok, s.cookieDomain, s.cookieSecure)
	return nil
}

func (s *Server) getCSRF(w http.ResponseWriter, r *http.Request) {
	tok, err := newCSRFToken()
	if err != nil {
		log.Printf("csrf: new token: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeCSRFCookie(w, tok, s.cookieDomain, s.cookieSecure)
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"token": tok})
}

type authCreds struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func validateCreds(c authCreds) error {
	if strings.TrimSpace(c.Username) == "" {
		return fmt.Errorf("username: must not be blank")
	}
	if strings.TrimSpace(c.Password) == "" {
		return fmt.Errorf("password: must not be blank")
	}
	return nil
}

func isPGUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}

func (s *Server) postRegister(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.users == nil {
		s.noDB(w)
		return
	}
	var body authCreds
	if err := httpx.ReadJSON(r, &body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if err := validateCreds(body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	user := strings.TrimSpace(body.Username)
	ctx := r.Context()
	exists, err := s.users.ExistsByUsernameIgnoreCase(ctx, user)
	if err != nil {
		log.Printf("register: exists check: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if exists {
		http.Error(w, "username already exists", http.StatusConflict)
		return
	}
	id := uuid.NewString()
	pass := auth.EncodeUserPassword(body.Password)
	if err := s.users.Insert(ctx, id, user, pass); err != nil {
		if isPGUniqueViolation(err) {
			http.Error(w, "username already exists", http.StatusConflict)
			return
		}
		log.Printf("register: insert user: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := s.saveSession(w, r, id, user); err != nil {
		log.Printf("register: save session: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := s.issueCSRF(w); err != nil {
		log.Printf("register: issue csrf: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, map[string]string{"id": id, "username": user})
}

func (s *Server) postLogin(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.users == nil {
		s.noDB(w)
		return
	}
	var body authCreds
	if err := httpx.ReadJSON(r, &body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if err := validateCreds(body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	user := strings.TrimSpace(body.Username)
	ctx := r.Context()
	u, err := s.users.FindByUsernameIgnoreCase(ctx, user)
	if err != nil {
		log.Printf("login: find user: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if u == nil || !auth.UserPasswordMatches(body.Password, u.Password) {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}
	if err := s.saveSession(w, r, u.ID, u.Username); err != nil {
		log.Printf("login: save session: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := s.issueCSRF(w); err != nil {
		log.Printf("login: issue csrf: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"id": u.ID, "username": u.Username})
}

func (s *Server) postLogout(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := s.sessionUser(r); !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if err := s.clearSession(w, r); err != nil {
		log.Printf("logout: clear session: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	clearCSRFCookie(w, s.cookieDomain, s.cookieSecure)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) getMe(w http.ResponseWriter, r *http.Request) {
	if s.authMode == AuthModeAuth0 {
		uid, name, ok := s.auth0User(w, r)
		if !ok {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"id": uid, "username": name})
		return
	}
	uid, name, ok := s.sessionUser(r)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"id": uid, "username": name})
}
