# GDTracker backups (PostgreSQL → Cloudflare R2)

Weekly backups on **devserver.local** dump the PostgreSQL database from Docker and upload compressed dumps to **Cloudflare R2** for off-site storage.

## Where things run

| Component | Location |
|---|---|
| **PostgreSQL (source)** | Raspberry Pi **`devserver.local`** — container `gdtracker-postgres`, volume `gdtracker-pgdata` ([`docker-compose.yml`](../docker-compose.yml)) |
| **Backup upload target** | **Cloudflare R2** (object storage) |
| Backup script | [`scripts/backup-to-r2.sh`](../scripts/backup-to-r2.sh) |
| Upload client | **[rclone](https://rclone.org/)** (Cloudflare R2 provider — no AWS tools) |
| Env variable names | [`.env.backup.example`](../.env.backup.example) |

The database stays on the Pi. R2 is only the remote copy.

## What gets backed up

- **All application data** in the `gdtracker` database: users, games, tasks, planning markdown, Excalidraw scenes, etc.
- **Not backed up separately:** Excalidraw scenes are JSONB rows in Postgres, included in every dump.

## Prerequisites (devserver.local)

Install on the Pi (once):

```bash
ssh admin@devserver.local

# rclone — upload/list/delete to R2
sudo apt update && sudo apt install -y rclone

# Docker + Compose stack already running gdtracker-postgres
docker ps --filter name=gdtracker-postgres
```

The backup job must run **on the Pi** (Jenkins agent on devserver.local, manual SSH session, or cron).

---

## 1. Cloudflare R2 setup (one-time)

1. Cloudflare dashboard → **R2 → Create bucket** (e.g. `gdtracker-backups`).
2. **Manage R2 API tokens → Create API token** scoped to that bucket:
   - Object Read & Write
   - Object Delete (retention prune)
3. Note **endpoint URL**, **Access Key ID**, and **Secret Access Key**.

Verify from the Pi:

```bash
ssh admin@devserver.local

export R2_ENDPOINT="https://<account_id>.r2.cloudflarestorage.com"
export R2_BUCKET="gdtracker-backups"
export R2_ACCESS_KEY_ID="<access_key_id>"
export R2_SECRET_ACCESS_KEY="<secret_access_key>"

export RCLONE_CONFIG_r2_TYPE=s3
export RCLONE_CONFIG_r2_PROVIDER=Cloudflare
export RCLONE_CONFIG_r2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_r2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_r2_ENDPOINT="$R2_ENDPOINT"
export RCLONE_CONFIG_r2_ACL=private

rclone lsd "r2:${R2_BUCKET}"
```

Store credentials in **Jenkins** (or a root-only env file on the Pi), not in git.

---

## 2. Manual backup (devserver.local)

```bash
ssh admin@devserver.local
cd /path/to/gdtracker   # repo checkout on the Pi

export R2_ENDPOINT="https://<account_id>.r2.cloudflarestorage.com"
export R2_BUCKET="gdtracker-backups"
export R2_ACCESS_KEY_ID="<access_key_id>"
export R2_SECRET_ACCESS_KEY="<secret_access_key>"
export COMPOSE_DIR="$(pwd)"

./scripts/backup-to-r2.sh
```

Success: console shows `[backup-to-r2] upload complete` and the R2 bucket has a new `.dump` under `gdtracker/pg/<YYYY>/<MM>/<DD>/`.

---

## 3. Jenkins job: `gdtracker-backup-weekly`

Create a job on the **devserver.local** Jenkins agent.

### Build triggers

- **Build periodically:** `H 3 * * 0` (weekly ~03:00 UTC Sunday)

### Environment / credentials

| Variable | Source |
|---|---|
| `R2_ACCESS_KEY_ID` | R2 API token (Jenkins secret) |
| `R2_SECRET_ACCESS_KEY` | R2 API token (Jenkins secret) |
| `R2_ENDPOINT` | Plain env on job |
| `R2_BUCKET` | Plain env on job |

Optional:

| Variable | Default |
|---|---|
| `R2_PREFIX` | `gdtracker/pg` |
| `POSTGRES_USER` | `gdtracker` |
| `POSTGRES_DB` | `gdtracker` |
| `POSTGRES_CONTAINER` | `gdtracker-postgres` |
| `BACKUP_RETENTION_COUNT` | `8` |
| `COMPOSE_DIR` | Repo path on devserver.local |

### Execute shell

```bash
set -euo pipefail

GDTRACKER_ROOT="${GDTRACKER_ROOT:-$(pwd)}"
export COMPOSE_DIR="${COMPOSE_DIR:-$GDTRACKER_ROOT}"

# If production uses the prod overlay:
# export COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml

test -x "${GDTRACKER_ROOT}/scripts/backup-to-r2.sh"
"${GDTRACKER_ROOT}/scripts/backup-to-r2.sh"
```

---

## 4. Object layout and retention

Each run uploads:

```text
r2:<bucket>/gdtracker/pg/<YYYY>/<MM>/<DD>/gdtracker-<UTC-timestamp>.dump
```

Format: PostgreSQL custom format (`pg_dump -Fc`), compressed.

The script keeps the newest **`BACKUP_RETENTION_COUNT`** dumps (default **8**) and deletes older objects.

---

## 5. Restore procedure (devserver.local)

**Warning:** restore overwrites data. Test on a clone first.

### 5.1 Download a dump from R2

On the Pi:

```bash
ssh admin@devserver.local

export R2_ENDPOINT="https://<account_id>.r2.cloudflarestorage.com"
export R2_BUCKET="gdtracker-backups"
export R2_ACCESS_KEY_ID="<access_key_id>"
export R2_SECRET_ACCESS_KEY="<secret_access_key>"

export RCLONE_CONFIG_r2_TYPE=s3
export RCLONE_CONFIG_r2_PROVIDER=Cloudflare
export RCLONE_CONFIG_r2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_r2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_r2_ENDPOINT="$R2_ENDPOINT"
export RCLONE_CONFIG_r2_ACL=private

OBJECT_KEY="gdtracker/pg/2026/06/15/gdtracker-20260615T030012Z.dump"  # example

rclone copyto "r2:${R2_BUCKET}/${OBJECT_KEY}" ./restore.dump
```

### 5.2 Restore into Postgres

```bash
cd /path/to/gdtracker
docker compose stop backend

docker exec -i gdtracker-postgres pg_restore \
  -U gdtracker -d gdtracker --clean --if-exists --no-owner --role=gdtracker \
  < ./restore.dump

docker compose start backend
```

### 5.3 Safer test restore (separate database)

```bash
docker exec gdtracker-postgres psql -U gdtracker -c "CREATE DATABASE gdtracker_restore_test;"
docker exec -i gdtracker-postgres pg_restore \
  -U gdtracker -d gdtracker_restore_test --no-owner --role=gdtracker \
  < ./restore.dump
docker exec gdtracker-postgres psql -U gdtracker -c "DROP DATABASE gdtracker_restore_test;"
```

Excalidraw scenes restore with the database — no separate file step.

---

## 6. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `postgres container not running` | Compose stack down on devserver.local |
| `pg_dump produced an empty file` | Wrong `POSTGRES_USER` / `POSTGRES_DB` |
| rclone access denied | R2 token permissions or wrong bucket/endpoint |
| Retention prune skipped | Token missing list/delete permission |
| `required command not found: rclone` | Run `sudo apt install -y rclone` on the Pi |

---

## Related docs

- Deploy host rule: [`.cursor/rules/deployment-devserver.mdc`](../.cursor/rules/deployment-devserver.mdc)
- Deploy stack: [`DEPLOY_AUTH0.md`](DEPLOY_AUTH0.md)
- Postgres volume: [`README.md`](../README.md)
