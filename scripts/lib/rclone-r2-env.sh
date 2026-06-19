# Shared ephemeral rclone remote for Cloudflare R2 (Object Read & Write tokens).
# Source after R2_* env vars and RCLONE_REMOTE (default: r2) are set.

rclone_env_remote_key() {
    printf '%s' "${RCLONE_REMOTE:-r2}" | tr '[:lower:]' '[:upper:]' | tr '-' '_'
}

configure_rclone_r2_env() {
    local key
    key="$(rclone_env_remote_key)"
    export RCLONE_CONFIG="${RCLONE_CONFIG:-}"
    export "RCLONE_CONFIG_${key}_TYPE=s3"
    export "RCLONE_CONFIG_${key}_PROVIDER=Cloudflare"
    export "RCLONE_CONFIG_${key}_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}"
    export "RCLONE_CONFIG_${key}_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}"
    export "RCLONE_CONFIG_${key}_ENDPOINT=${R2_ENDPOINT}"
    export "RCLONE_CONFIG_${key}_ACL=private"
    export "RCLONE_CONFIG_${key}_NO_CHECK_BUCKET=true"
}

rclone_remote_path() {
    printf '%s:%s/%s' "${RCLONE_REMOTE:-r2}" "$R2_BUCKET" "$1"
}
