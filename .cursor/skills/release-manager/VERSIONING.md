# Versioning reference (GDTracker)

Per-app semantic versioning. Each app bumps independently.

## Trigger files (CI)

To cut a release, change **only** these files for the affected app(s). Merging to **`main`** triggers [automated tagging](#automated-tagging-github-actions).

| App | Trigger file (only) | Field | Tag created by CI |
|-----|---------------------|-------|-------------------|
| `gdtracker-web` | `gdtracker-web/package.json` | `"version"` | `gdtracker-web/vX.Y.Z` |
| `gdtracker-go-api` | `gdtracker-go-api/docs/openapi.yaml` | `info.version` | `gdtracker-go-api/vX.Y.Z` |
| `gdtracker-api` (deprecated) | `gdtracker-api/pom.xml` | `<version>` (project) | Not automated |

**Do not edit** `.github/workflows/release-tag.yml` or `.github/scripts/create-release-tags.sh` for routine releases.

**Baseline (2026):** web `0.1.1`, go-api `0.5.0`, spring-api `0.0.1-SNAPSHOT` (spring-api not tagged).

There is no root `VERSION` file. OpenAPI `info.version` is the canonical version for the Go API until a dedicated file is added.

## Tag naming

Format: `<app>/v<semver>`

Examples:
- `gdtracker-web/v0.1.0`
- `gdtracker-go-api/v0.6.0`
- `gdtracker-api/v0.0.2`

Pre-release: `gdtracker-go-api/v0.6.0-beta.1`

## Bump checklist (CI-first)

- [ ] Identify which app(s) changed in this release.
- [ ] Choose MAJOR / MINOR / PATCH per app (see release-manager skill).
- [ ] Update **trigger file(s) only** for changed apps.
- [ ] Run relevant tests/build for touched apps.
- [ ] Commit: `chore(release): bump <app> to X.Y.Z`
- [ ] Merge to `dev`, then merge **`dev` → `main`** (or bump directly on `main`).
- [ ] Verify GitHub Actions **Release tag** created the expected tag(s).
- [ ] Edit GitHub release notes (features, fixes, breaking changes, cross-app compatibility).
- [ ] No secrets in commits (check `.env`, local notes files).

## Cross-app compatibility

When a frontend release requires a minimum API version, state it in release notes:

```markdown
## Compatibility
- gdtracker-web v0.2.0 requires gdtracker-go-api >= v0.6.0
```

## Rollback

1. Delete remote tag (if pushed): `git push origin --delete <tag>`
2. Delete local tag: `git tag -d <tag>`
3. Revert the version-bump commit or restore previous version in the trigger file.
4. Delete GitHub release: `gh release delete <tag>`

## Branch → commit type quick reference

| Branch | Commit type |
|--------|-------------|
| `feature/*` | `feat` |
| `fix/*`, `hotfix/*` | `fix` |
| `release/*` | `chore(release)` |

## Integration branch

Default integration branch in this repo: **`dev`** (confirm with `git branch -a` if unsure). Create feature branches from an up-to-date `dev` unless the user specifies otherwise.

**Production tags** are created from **`main`**: merge the version-bump commit to `main` to trigger automation. Day-to-day work stays on `dev`; cut releases by merging `dev` → `main` (or cherry-pick the bump commit).

A version bump on `dev` **does not** create a tag until that commit is on `main`.

## Automated tagging (GitHub Actions)

| Item | Path |
|------|------|
| Workflow | [`.github/workflows/release-tag.yml`](../../.github/workflows/release-tag.yml) |
| Script | [`.github/scripts/create-release-tags.sh`](../../.github/scripts/create-release-tags.sh) |

**When it runs**

- Push to **`main`** that changes a [trigger file](#trigger-files-ci)
- Manual: Actions → **Release tag** → **Run workflow**

**What it does**

1. Read semver from **gdtracker-web** and **gdtracker-go-api** trigger files at `HEAD`
2. Skip `*-SNAPSHOT` and invalid semver
3. If tag `<app>/vX.Y.Z` does not exist → create annotated tag, push, open GitHub release
4. Idempotent: existing tags are skipped

**Not automated:** `gdtracker-api` (deprecated, SNAPSHOT) — manual only if ever needed.

**Release flow (recommended)**

1. Bump trigger file on a branch; merge feature/fix to `dev`
2. Merge `dev` → `main`
3. CI creates tag + release — no manual `git tag` unless automation failed
4. Edit release notes on GitHub if needed

**Manual fallback**

```bash
git switch main && git pull
bash .github/scripts/create-release-tags.sh
```

Requires `gh` authenticated and permission to push tags.

**Permissions:** workflow uses `contents: write` (tags + releases). Default `GITHUB_TOKEN` is sufficient for same-repo releases.
