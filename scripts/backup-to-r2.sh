#!/usr/bin/env bash
# Dump PostgreSQL from gdtracker-postgres on devserver.local and upload to Cloudflare R2.
# Uses rclone (not AWS CLI). See docs/BACKUPS.md.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/rclone-r2-env.sh
source "${SCRIPT_DIR}/lib/rclone-r2-env.sh"

log() {
    printf '[backup-to-r2] %s\n' "$*" >&2
}

die() {
    log "ERROR: $*"
    exit 1
}

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

require_env() {
    local name="$1"
    [[ -n "${!name:-}" ]] || die "required environment variable not set: $name"
}

# --- configuration (defaults match docker-compose.yml on devserver.local) ---
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-gdtracker-postgres}"
POSTGRES_USER="${POSTGRES_USER:-gdtracker}"
POSTGRES_DB="${POSTGRES_DB:-gdtracker}"
R2_PREFIX="${R2_PREFIX:-gdtracker/pg}"
BACKUP_RETENTION_COUNT="${BACKUP_RETENTION_COUNT:-8}"
COMPOSE_DIR="${COMPOSE_DIR:-}"
RCLONE_REMOTE="${RCLONE_REMOTE:-r2}"

if ! [[ "$BACKUP_RETENTION_COUNT" =~ ^[0-9]+$ ]] || (( BACKUP_RETENTION_COUNT < 1 )); then
    die "BACKUP_RETENTION_COUNT must be a positive integer (got: ${BACKUP_RETENTION_COUNT})"
fi

require_env R2_ENDPOINT
require_env R2_BUCKET
require_env R2_ACCESS_KEY_ID
require_env R2_SECRET_ACCESS_KEY

require_cmd docker
require_cmd rclone

configure_rclone_r2_env

if [[ -n "$COMPOSE_DIR" ]]; then
    [[ -d "$COMPOSE_DIR" ]] || die "COMPOSE_DIR is not a directory: $COMPOSE_DIR"
fi

if ! docker inspect "$POSTGRES_CONTAINER" >/dev/null 2>&1; then
    die "postgres container not running or not found: $POSTGRES_CONTAINER"
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
year="$(date -u +%Y)"
month="$(date -u +%m)"
day="$(date -u +%d)"
object_key="${R2_PREFIX}/${year}/${month}/${day}/gdtracker-${timestamp}.dump"
remote_path="$(rclone_remote_path "$object_key")"

tmpdir=""
cleanup() {
    if [[ -n "$tmpdir" && -d "$tmpdir" ]]; then
        rm -rf "$tmpdir"
    fi
}
trap cleanup EXIT

tmpdir="$(mktemp -d)"
dump_file="${tmpdir}/gdtracker-${timestamp}.dump"

log "starting pg_dump (container=${POSTGRES_CONTAINER}, db=${POSTGRES_DB}, user=${POSTGRES_USER})"
start_ts="$(date +%s)"

if [[ -n "$COMPOSE_DIR" ]]; then
    docker compose -f "${COMPOSE_DIR}/docker-compose.yml" exec -T postgres \
        pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc >"$dump_file"
else
    docker exec "$POSTGRES_CONTAINER" \
        pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc >"$dump_file"
fi

dump_bytes="$(wc -c <"$dump_file" | tr -d ' ')"
[[ "$dump_bytes" -gt 0 ]] || die "pg_dump produced an empty file"

log "uploading ${dump_bytes} bytes to ${remote_path}"
rclone copyto "$dump_file" "$remote_path"

elapsed="$(( $(date +%s) - start_ts ))"
log "upload complete in ${elapsed}s: ${remote_path}"

prune_old_backups() {
    local listing sorted_rel count to_delete deleted i rel_path full_key remote_listing

    remote_listing="$(rclone_remote_path "$R2_PREFIX")"
    listing="$(mktemp)"
    if ! rclone lsl "$remote_listing" --recursive >"$listing"; then
        rm -f "$listing"
        log "WARN: could not list objects for retention prune; skipping"
        return 0
    fi

    mapfile -t sorted_rel < <(
        grep '\.dump$' "$listing" | awk '{printf "%sT%s %s\n", $2, $3, $4}' | sort | awk '{print $2}'
    )
    rm -f "$listing"

    count="${#sorted_rel[@]}"
    if (( count <= BACKUP_RETENTION_COUNT )); then
        log "retention: ${count} dump(s) present (keep ${BACKUP_RETENTION_COUNT}); nothing to prune"
        return 0
    fi

    to_delete=$(( count - BACKUP_RETENTION_COUNT ))
    log "retention: pruning ${to_delete} oldest dump(s) (keeping ${BACKUP_RETENTION_COUNT})"
    deleted=0
    for (( i = 0; i < to_delete; i++ )); do
        rel_path="${sorted_rel[$i]}"
        full_key="${R2_PREFIX}/${rel_path}"
        rclone delete "$(rclone_remote_path "$full_key")"
        deleted=$(( deleted + 1 ))
    done
    log "retention: deleted ${deleted} object(s)"
}

prune_old_backups
log "backup finished successfully"
