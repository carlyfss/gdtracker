---
name: cloudflare-r2-rclone
description: >-
  Configure and troubleshoot Cloudflare R2 with rclone on devserver.local (Raspberry Pi).
  Use when setting up R2 backups, fixing rclone remote/config errors, verifying bucket access,
  or wiring scripts/backup-to-r2.sh to an rclone remote. Not AWS — R2 only.
---

# Cloudflare R2 + rclone (GDTracker)

## Context

- **Host:** Raspberry Pi `devserver.local` — see [deployment-devserver rule](../../rules/deployment-devserver.mdc)
- **Backup script:** [`scripts/backup-to-r2.sh`](../../scripts/backup-to-r2.sh)
- **Connectivity test:** [`scripts/test-r2-rclone.sh`](../../scripts/test-r2-rclone.sh)
- **Shared rclone env:** [`scripts/lib/rclone-r2-env.sh`](../../scripts/lib/rclone-r2-env.sh)
- **Runbook:** [`docs/BACKUPS.md`](../../docs/BACKUPS.md)

## Golden rules

1. **`endpoint` = account URL only** — never append the bucket name.
2. **Remote syntax:** `RemoteName:bucket/path` — section name before `:`.
3. **Object Read & Write tokens** need `no_check_bucket = true` — backup/test scripts set this via env automatically.
4. **Jenkins** runs as user `jenkins`; admin’s `rclone.conf` is not used unless copied or env vars are set in the job.

## Object Read & Write vs Admin (403)

| Symptom | Cause | Fix |
|---|---|---|
| 403 on upload with Object token | rclone checks/creates bucket before write | `no_check_bucket=true` (scripts do this) |
| 403 with Admin token only | Wrong endpoint, unscoped token, or wrong remote syntax | Fix endpoint; scope token to bucket |
| Works with Admin, not Object | Same as above — not a Cloudflare bug in your setup | Use [`test-r2-rclone.sh`](../../scripts/test-r2-rclone.sh) after script update |

**Token permission:** use **Object Read & Write** scoped to the backup bucket — Admin is not required when `no_check_bucket` is set and delete works (retention hard-fails if delete returns 403).

## Test before backup

```bash
export R2_ENDPOINT="https://<account_id>.r2.cloudflarestorage.com"
export R2_BUCKET="gdtracker-backup"
export R2_ACCESS_KEY_ID="..."
export R2_SECRET_ACCESS_KEY="..."

./scripts/test-r2-rclone.sh
```

As Jenkins user on the Pi:

```bash
sudo -u jenkins env R2_ENDPOINT=... R2_BUCKET=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
  /var/lib/jenkins/workspace/GDTracker\ -\ Backup/scripts/test-r2-rclone.sh
```

## Interactive `rclone config` (optional)

| Prompt | Value |
|---|---|
| name | `r2` |
| Storage | `s3` |
| provider | `Cloudflare` |
| endpoint | `https://<account_id>.r2.cloudflarestorage.com` |
| no_check_bucket | `true` |

## Jenkins workspaces

- **Deploy:** `/var/lib/jenkins/workspace/GDTracker` → set `COMPOSE_DIR` here
- **Backup job:** `/var/lib/jenkins/workspace/GDTracker - Backup` → script checkout only

## Error → fix

| Error | Fix |
|---|---|
| `didn't find section in config file` | Set `R2_*` in Jenkins job; scripts build ephemeral `r2` remote |
| `directory not found` | Remove bucket from endpoint URL |
| `service "postgres" is not running` | `COMPOSE_DIR` must be deploy workspace, not backup workspace |
| 403 AccessDenied on upload | Ensure scripts include `NO_CHECK_BUCKET=true`; run `test-r2-rclone.sh` |

## Related

- [`docs/BACKUPS.md`](../../docs/BACKUPS.md) — full runbook
- [infra/SKILL.md](../infra/SKILL.md) — Jenkins job setup
