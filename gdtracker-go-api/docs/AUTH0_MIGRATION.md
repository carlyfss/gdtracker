# Auth0 user migration

One-time migration from session-mode Postgres users to Auth0 while preserving `users.id` (and `games.user_id` FKs).

## Prerequisites

- Auth0 tenant with Database Connection configured ([`AUTH.md`](AUTH.md))
- `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` set (same as API)

## Steps

### 1. Export import JSON

```bash
cd gdtracker-go-api
go run ./cmd/migrate-auth0-users -export-import-json auth0-users.json
```

This reads all `users` rows and writes Auth0 bulk-import JSON with bcrypt password hashes derived from current stored passwords.

### 2. Import into Auth0

1. Auth0 Dashboard → **User Management → Import Users**
2. Select your Database Connection
3. Upload `auth0-users.json`
4. Each row includes `user_id` set to the Postgres UUID — set `app_metadata.gdtracker_user_id` to the same value (via import script extension or Management API) so the Post Login Action can emit the custom claim.

### 3. Backfill `auth0_sub`

After import, export Auth0 user ids (CSV with columns `id`, `auth0_sub` where `id` is Postgres UUID):

```bash
go run ./cmd/migrate-auth0-users -backfill-csv auth0-subs.csv
```

### 4. Cutover

1. Deploy API with `AUTH_MODE=auth0`, `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`
2. Deploy frontend with `VITE_AUTH_MODE=auth0` and Auth0 SPA env vars
3. Users sign in once through Auth0 Universal Login

## Rollback

Set `AUTH_MODE=session` on the API and `VITE_AUTH_MODE=session` on the frontend. Existing `users.auth0_sub` values are harmless; session login continues to use username/password in Postgres.
