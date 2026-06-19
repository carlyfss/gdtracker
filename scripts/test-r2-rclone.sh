#!/usr/bin/env bash
# Verify Cloudflare R2 access with an Object Read & Write token (upload, list, delete).
# Does not run pg_dump. See docs/BACKUPS.md.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/rclone-r2-env.sh
source "${SCRIPT_DIR}/lib/rclone-r2-env.sh"

log() {
    printf '[test-r2-rclone] %s\n' "$*" >&2
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

RCLONE_REMOTE="${RCLONE_REMOTE:-r2}"
R2_TEST_PREFIX="${R2_TEST_PREFIX:-gdtracker/test}"

require_env R2_ENDPOINT
require_env R2_BUCKET
require_env R2_ACCESS_KEY_ID
require_env R2_SECRET_ACCESS_KEY

require_cmd rclone

configure_rclone_r2_env

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
object_key="${R2_TEST_PREFIX}/connection-${timestamp}.txt"
remote_path="$(rclone_remote_path "$object_key")"
list_prefix="$(rclone_remote_path "$R2_TEST_PREFIX")"

tmpdir=""
cleanup() {
    if [[ -n "$tmpdir" && -d "$tmpdir" ]]; then
        rm -rf "$tmpdir"
    fi
}
trap cleanup EXIT

tmpdir="$(mktemp -d)"
test_file="${tmpdir}/connection-${timestamp}.txt"
printf 'gdtracker r2 connection test %s\n' "$timestamp" >"$test_file"

log "uploading test object to ${remote_path}"
rclone copyto "$test_file" "$remote_path"

log "listing prefix ${list_prefix}"
if ! rclone ls "$list_prefix" | grep -q "connection-${timestamp}.txt"; then
    die "uploaded object not found under ${list_prefix}"
fi

log "deleting test object ${remote_path}"
rclone delete "$remote_path"

log "OK — Object Read & Write token can upload, list, and delete"
