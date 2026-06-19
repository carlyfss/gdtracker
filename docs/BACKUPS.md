# GDTracker backups (PostgreSQL → Cloudflare R2)

Weekly backups on the **deploy host** dump the PostgreSQL database from Docker and upload compressed dumps to **Cloudflare R2** for off-site storage.

Use real host from `.env.deploy`; docs use `deploy-host.local` as placeholder.

## Where things run

| Component | Location |
|---|---|
| **PostgreSQL (source)** | Raspberry Pi **deploy host** (`DEPLOY_HOST` in `.env.deploy`) — container `gdtracker-postgres`, volume `gdtracker-pgdata` ([`docker-compose.yml`](../docker-compose.yml)) |
| **Backup upload target** | **Cloudflare R2** (object storage) |
| Backup script | [`scripts/backup-to-r2.sh`](../scripts/backup-to-r2.sh) |
| R2 connectivity test | [`scripts/test-r2-rclone.sh`](../scripts/test-r2-rclone.sh) |
| Upload client | **[rclone](https://rclone.org/)** (Cloudflare R2 provider — no AWS tools) |
| Env variable names | [`.env.backup.example`](../.env.backup.example) |

The database stays on the Pi. R2 is only the remote copy.

## What gets backed up

- **All application data** in the `gdtracker` database: users, games, tasks, planning markdown, Excalidraw scenes, etc.
- **Not backed up separately:** Excalidraw scenes are JSONB rows in Postgres, included in every dump.

## Prerequisites (deploy host)

Install on the Pi (once):

```bash
ssh admin@deploy-host.local

# rclone — upload/list/delete to R2
sudo apt update && sudo apt install -y rclone

# Docker + Compose stack already running gdtracker-postgres
docker ps --filter name=gdtracker-postgres
```

The backup job must run **on the Pi** (Jenkins agent on the deploy host, manual SSH session, or cron).

---

## 1. Cloudflare R2 setup (one-time)

1. Cloudflare dashboard → **R2 → Create bucket** (e.g. `gdtracker-backup`).
2. **Manage R2 API tokens → Create API token** scoped to that bucket:
   - **Object Read & Write** (read, write, list, and delete objects in the bucket — sufficient for backups; Admin not required)
3. Note **endpoint URL** (account URL only — no bucket suffix), **Access Key ID**, and **Secret Access Key**.

The backup scripts set rclone `no_check_bucket=true` automatically (required for Object-scoped tokens).

Verify from the Pi (run as the same OS user as Jenkins — usually `jenkins`):

```bash
ssh admin@deploy-host.local

export R2_ENDPOINT="https://<account_id>.r2.cloudflarestorage.com"
export R2_BUCKET="gdtracker-backup"
export R2_ACCESS_KEY_ID="<access_key_id>"
export R2_SECRET_ACCESS_KEY="<secret_access_key>"

cd /path/to/gdtracker
./scripts/test-r2-rclone.sh
```

Success: `[test-r2-rclone] OK — Object Read & Write token can upload, list, and delete`.

Store credentials in **Jenkins** (or a root-only env file on the Pi), not in git.

For rclone setup pitfalls (endpoint URL, remote naming, common errors), see [`.cursor/skills/cloudflare-r2-rclone/SKILL.md`](../.cursor/skills/cloudflare-r2-rclone/SKILL.md).

---

## 2. Manual backup (deploy host)

```bash
ssh admin@deploy-host.local
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

## 3. Jenkins job: `GDTracker - Backup`

Create a job on the **deploy host** Jenkins agent. Jenkins runs as user **`jenkins`** — R2 credentials must be in the job env (not only in admin’s `~/.config/rclone/rclone.conf`).

### Two workspaces

| Job | Workspace | Purpose |
|---|---|---|
| **GDTracker** (deploy) | `/var/lib/jenkins/workspace/GDTracker` | Where `docker compose up` runs; Postgres project lives here |
| **GDTracker - Backup** | `/var/lib/jenkins/workspace/GDTracker - Backup` | Checkout for backup script only |

Set **`COMPOSE_DIR`** to the **deploy** workspace, not the backup workspace:

```bash
export COMPOSE_DIR="/var/lib/jenkins/workspace/GDTracker"
```

Confirm with:

```bash
docker inspect gdtracker-postgres --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'
```

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
| `COMPOSE_DIR` | `/var/lib/jenkins/workspace/GDTracker` (deploy workspace) |

### Execute shell

```bash
set -euo pipefail

GDTRACKER_ROOT="${WORKSPACE}"
export COMPOSE_DIR="/var/lib/jenkins/workspace/GDTracker"

# R2_* must be bound from Jenkins credentials (jenkins user has no admin rclone.conf)

test -x "${GDTRACKER_ROOT}/scripts/backup-to-r2.sh"
"${GDTRACKER_ROOT}/scripts/backup-to-r2.sh"
```

Optional: run [`scripts/test-r2-rclone.sh`](../scripts/test-r2-rclone.sh) in a separate test job before enabling the weekly schedule.

---

## 4. Object layout and retention

Each run uploads:

```text
r2:<bucket>/gdtracker/pg/<YYYY>/<MM>/<DD>/gdtracker-<UTC-timestamp>.dump
```

Format: PostgreSQL custom format (`pg_dump -Fc`), compressed.

The script keeps the newest **`BACKUP_RETENTION_COUNT`** dumps (default **8**) and deletes older objects.

---

## 5. Restore procedure (deploy host)

**Warning:** restore overwrites data. Test on a clone first.

### 5.1 Download a dump from R2

On the Pi:

```bash
ssh admin@deploy-host.local

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
| `postgres container not running` | Compose stack down on the deploy host |
| `pg_dump produced an empty file` | Wrong `POSTGRES_USER` / `POSTGRES_DB` |
| rclone 403 on upload with Object token | Missing `no_check_bucket` — use current scripts (set automatically) or Admin token |
| `service "postgres" is not running` | Wrong `COMPOSE_DIR` — use deploy workspace `GDTracker`, not backup workspace |
| Retention prune skipped | Token missing list/delete permission |
| `required command not found: rclone` | Run `sudo apt install -y rclone` on the Pi |
| rclone `didn't find section in config file` | Wrong remote syntax — use `RemoteName:bucket`, not `r2:RemoteName`; see [cloudflare-r2-rclone skill](../.cursor/skills/cloudflare-r2-rclone/SKILL.md) |
| rclone `directory not found` | Bucket name in endpoint URL — endpoint must be account URL only |

---

## Related docs

- R2 + rclone setup: [`.cursor/skills/cloudflare-r2-rclone/SKILL.md`](../.cursor/skills/cloudflare-r2-rclone/SKILL.md)
- Deploy host rule: [`.cursor/rules/deployment-host.mdc`](../.cursor/rules/deployment-host.mdc)
- Deploy stack: [`DEPLOY_AUTH0.md`](DEPLOY_AUTH0.md)
- Postgres volume: [`README.md`](../README.md)
