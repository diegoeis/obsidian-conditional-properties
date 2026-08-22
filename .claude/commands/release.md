---
description: Release Command
---

# Release Command

Run this command when ready to ship a new release. This repo has **no build step** — `main.js` is edited directly and is exactly what Obsidian loads. The steps below mirror `.github/workflows/release.yml` and the release checklist in root `CLAUDE.md`.

## Steps

1. **Sanity-check the working tree** — no stray `console.log()`, feature already verified live via `./scripts/sync.sh`:
   ```
   git status
   grep -n "console.log" main.js
   ```

2. **Bump the version** in `manifest.json` (`X.Y.Z`, semver) and add the matching entry to `versions.json` (`"X.Y.Z": "<minAppVersion>"`).

3. **Update docs alongside the version bump**:
   - `CHANGELOG.md` — what changed and why
   - `.claude/docs/features-info.md` — if user-facing behavior changed
   - Any related PRD/FRD under `.claude/docs/product/` — if a spec exists

4. **Commit**:
   ```
   git add manifest.json versions.json CHANGELOG.md
   git commit -m "chore: bump version to X.Y.Z"
   ```

5. **Tag — no `v` prefix**:
   ```
   git tag X.Y.Z
   ```

## Tag Convention

**CRITICAL**: Tags must NEVER have a `v` prefix.

- ✅ Correct: `0.23.1`, `0.24.0`, `1.0.0`
- ❌ Wrong: `v0.23.1`, `v0.24.0`, `v1.0.0`

Create the tag **only on push**, per `.claude/rules.md` / root `CLAUDE.md`.

6. **Push everything**:
   ```
   git push origin <branch>
   git push origin X.Y.Z
   ```

7. **Publish a GitHub release from the tag.** This triggers `.github/workflows/release.yml`, which zips `manifest.json`, `main.js`, and `styles.css` and attaches them to the release automatically — no manual zip/upload needed.

## Local dry-run of the release artifact (optional)

To reproduce what the workflow does, without publishing anything:

```bash
PLUGIN_ID="conditional-properties"
mkdir -p dist
zip -j "dist/${PLUGIN_ID}.zip" manifest.json main.js styles.css
cp manifest.json dist/manifest.json
[ -f versions.json ] && cp versions.json dist/versions.json
```

## Quick Reference (copy-paste)

```bash
# after manifest.json / versions.json / CHANGELOG.md are updated and committed
git tag X.Y.Z
git push origin $(git branch --show-current)
git push origin X.Y.Z
# then publish a GitHub Release from tag X.Y.Z
```
