#!/usr/bin/env bash
# Create per-app semver tags and GitHub releases when version files on main match
# tags that do not exist yet. See .cursor/skills/release-manager/VERSIONING.md.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

read_web_version() {
    node -p "require('./gdtracker-web/package.json').version"
}

read_go_api_version() {
    awk '/^  version: / { print $2; exit }' gdtracker-go-api/docs/openapi.yaml
}

is_valid_semver() {
    [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]
}

tag_exists() {
    git rev-parse "$1" >/dev/null 2>&1
}

remote_tag_exists() {
    git ls-remote --exit-code --tags origin "$1" >/dev/null 2>&1
}

create_tag_and_release() {
    local app="$1"
    local version="$2"

    if [[ "$version" == *SNAPSHOT* ]]; then
        echo "skip $app: SNAPSHOT versions are not tagged"
        return 0
    fi

    if ! is_valid_semver "$version"; then
        echo "skip $app: invalid semver '$version'" >&2
        return 0
    fi

    local tag="${app}/v${version}"
    if tag_exists "$tag" || remote_tag_exists "$tag"; then
        echo "skip $tag: already exists"
        return 0
    fi

    echo "creating tag $tag at $(git rev-parse HEAD)"
    git config user.name "github-actions[bot]"
    git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
    git tag -a "$tag" -m "${app} v${version}"
    git push origin "$tag"

    local title="${app} v${version}"
    local notes="Automated release for \`${tag}\` at commit ${GITHUB_SHA:-$(git rev-parse HEAD)}."
    if command -v gh >/dev/null 2>&1; then
        gh release create "$tag" --title "$title" --notes "$notes" --verify-tag
    else
        echo "gh CLI not available; tag pushed without GitHub release"
    fi
}

main() {
    local web_version go_version
    web_version="$(read_web_version)"
    go_version="$(read_go_api_version)"

    echo "versions: web=$web_version go-api=$go_version"

    create_tag_and_release "gdtracker-web" "$web_version"
    create_tag_and_release "gdtracker-go-api" "$go_version"
}

main "$@"
