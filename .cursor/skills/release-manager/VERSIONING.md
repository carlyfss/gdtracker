# Versioning reference (GDTracker)

Per-app semantic versioning. Each app bumps independently.

## Version sources

| App | File | Field |
|-----|------|-------|
| `gdtracker-web` | `gdtracker-web/package.json` | `"version"` |
| `gdtracker-go-api` | `gdtracker-go-api/docs/openapi.yaml` | `info.version` |
| `gdtracker-api` (deprecated) | `gdtracker-api/pom.xml` | `<version>` (project) |

**Baseline (2025):** web `0.0.0`, go-api `0.5.0`, spring-api `0.0.1-SNAPSHOT`.

There is no root `VERSION` file. OpenAPI `info.version` is the canonical version for the Go API until a dedicated file is added.

## Tag naming

Format: `<app>/v<semver>`

Examples:
- `gdtracker-web/v0.1.0`
- `gdtracker-go-api/v0.6.0`
- `gdtracker-api/v0.0.2`

Pre-release: `gdtracker-go-api/v0.6.0-beta.1`

## Bump checklist

Before tagging:

- [ ] Identify which app(s) changed in this release.
- [ ] Choose MAJOR / MINOR / PATCH per app (see release-manager skill).
- [ ] Update only the version file(s) for changed apps.
- [ ] Run relevant tests/build for touched apps.
- [ ] Write release notes (features, fixes, breaking changes, compatible app versions).
- [ ] Tag matches version in file (no drift).
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
3. Revert the version-bump commit or restore previous version in the version file.
4. Delete GitHub release: `gh release delete <tag>`

## Branch → commit type quick reference

| Branch | Commit type |
|--------|-------------|
| `feature/*` | `feat` |
| `fix/*`, `hotfix/*` | `fix` |
| `release/*` | `chore(release)` |

## Integration branch

Default integration branch in this repo: **`dev`** (confirm with `git branch -a` if unsure). Create feature branches from an up-to-date `dev` unless the user specifies otherwise.
