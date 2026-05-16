# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this repo is

**Conditional Properties** — an Obsidian community plugin that automates frontmatter and note titles via IF/THEN rules.

This repo ships the **compiled plugin** directly. There is no TypeScript source, no `package.json`, no build step. `main.js` is what Obsidian loads and what you edit.

- Plugin id: `conditional-properties` (`manifest.json`)
- Entrypoint: `main.js` (single file, contains runtime + settings UI)
- Styles: `styles.css`
- Manifest: `manifest.json`
- Compatibility map: `versions.json`
- User state (do not commit changes blindly): `data.json`

## Project rules (must follow)

**Read these three files before changing anything non-trivial. They are the source of truth — these summaries are convenience only.**

1. **[.claude/rules.md](.claude/rules.md)** — project-wide rules: language, git/tag/changelog flow, "answer before implement" discipline. Always applies.
2. **[.claude/docs/DEVELOPMENT_GUIDELINES.md](.claude/docs/DEVELOPMENT_GUIDELINES.md)** — Obsidian-specific do/don'ts: which APIs to use, lint hot-spots reviewers check, mobile compatibility, testing checklist. Consult **before writing any new Obsidian code** so the plugin keeps passing the community lint.
3. **[.claude/docs/SUBMISSION_GUIDE.md](.claude/docs/SUBMISSION_GUIDE.md)** — community-plugin submission and release flow. Consult before every release and every PR against `obsidian-releases`.

### LLM operating rules

When making code or documentation changes to this plugin:

- **Default to the official Obsidian API.** If you're about to use `fetch`, `fs`, `innerHTML`, `localStorage`, `var`, `eval`, manual YAML parsing, or any non-registered listener — stop and consult `DEVELOPMENT_GUIDELINES.md` first. There is almost always an Obsidian-native equivalent.
- **Never strip the lint-safe patterns** already in `main.js` (e.g. `createEl`/`createDiv`, `this.register*`, `requestUrl`, `parseYaml`/`stringifyYaml`, `metadataCache`).
- **Touch the release artifacts together.** If you bump behavior, you also bump `manifest.json` version, add to `versions.json`, append `CHANGELOG.md`, update `.claude/docs/features-info.md`, and (if a spec exists) update the related PRD/FRD in `.claude/docs/product/`.
- **No new dependencies, no build step.** This repo intentionally ships compiled JS only.
- **Ask before implementing** if the request is ambiguous or the impact is non-trivial.

### Quick-reference summary

- **Language**: always English (code, commits, docs).
- **Git/release flow**: create the tag only on push; bump `manifest.json` + `versions.json`; tag is `X.Y.Z` (no `v`). For PR conflicts, force-push (don't recreate the branch).
- **Always update on a release-bearing push**: `CHANGELOG.md`, `.claude/docs/features-info.md`, and any relevant PRD/FRD under `.claude/docs/product/`.
- **Submission**: follow `.claude/docs/SUBMISSION_GUIDE.md` end-to-end before opening the `obsidian-releases` PR.

## Architecture (where things live in `main.js`)

Single class `ConditionalPropertiesPlugin extends Plugin` plus `ConditionalPropertiesSettingTab`. Key methods:

- `onload()` — loads settings via `loadData()`, runs `_migrateRules()`, registers scheduler interval, commands, and settings tab.
- Commands registered:
  - `conditional-properties-run-now` — "Run conditional rules on vault"
  - `conditional-properties-run-current-file` — "Run conditional rules on current file"
- `runScan()` → picks files via `_getFilesToScan()` (respecting `scanScope` + `scanCount`), reads frontmatter from `metadataCache.getFileCache(file).frontmatter`, then calls `applyRulesToFrontmatter()`.
- `applyRulesToFrontmatter(file, currentFrontmatter, rulesOverride?)` — evaluates each rule:
  - Source value: `_getNoteTitle(file)` for `FIRST_LEVEL_HEADING`, or `currentFrontmatter[ifProp]` for `PROPERTY`.
  - Condition check: `_matchesCondition(sourceValue, ifValue, op, ifType)`.
  - Property actions: `add` | `remove` | `overwrite` | `delete` | `rename`.
  - Title actions: `prefix` | `suffix` | `overwrite`, with `_formatText()` expanding `{date}`, `{date:FORMAT}`, `{filename}` placeholders.
- Persistence:
  - Title changes via `_updateNoteTitle(file, newTitle)`.
  - Frontmatter via `_writeFrontmatter(file, newFrontmatter)` — parses/stringifies with `parseYaml` / `stringifyYaml`, creates the YAML block if missing, deletes keys with `null`/`undefined`.

### Settings shape (`loadData()`)
```
rules: Rule[]
scanIntervalMinutes (min 5)
scanScope: latestCreated | latestModified | entireVault
scanCount
operatorMigrationVersion
```

### Rule shape
```
ifType: "PROPERTY" | "FIRST_LEVEL_HEADING"
ifProp: string
ifValue: string
op: exactly | contains | notContains | exists | notExists | isEmpty
thenActions: Array<
  { type: "property", prop, value, action: "add"|"remove"|"overwrite"|"delete"|"rename" }
| { type: "title", modificationType: "prefix"|"suffix"|"overwrite", text }
>
```

`exists`, `notExists`, `isEmpty` ignore `ifValue`.

## Development workflow

No build. Edit `main.js` / `styles.css` and reload the plugin in Obsidian (toggle off/on, or use the developer reload flow).

Recent fixes worth remembering when touching title logic:
- First-level heading detection: detect H1 **only when it appears immediately after YAML frontmatter** (see commit `29ea0bd`). Don't reintroduce broader scanning — it caused false positives.
- Inline title setting must be ignored when checking for H1 existence (commit `2af8ba5`).

## Release (mirrors `.github/workflows/release.yml`)

GitHub Actions triggers on published releases and zips `manifest.json`, `main.js`, `styles.css`. To reproduce locally:

```sh
PLUGIN_ID="conditional-properties"
mkdir -p dist
zip -j "dist/${PLUGIN_ID}.zip" manifest.json main.js styles.css
cp manifest.json dist/manifest.json
[ -f versions.json ] && cp versions.json dist/versions.json
```

Release checklist:
1. Bump `manifest.json` `version` (X.Y.Z).
2. Update `versions.json` mapping new version → `minAppVersion`.
3. Append entry to `CHANGELOG.md` (what + why).
4. Update `.claude/docs/features-info.md` and relevant PRD/FRD if behavior changed.
5. Tag `X.Y.Z` and push. Publish a GitHub Release with the tag to trigger the workflow.

## Things to avoid

- Don't introduce a TypeScript/build pipeline unless explicitly asked — the repo is intentionally source-shipped.
- Don't touch `data.json` as if it were source; it's per-vault user state.
- Don't modify body content of notes — the plugin's contract is "only frontmatter and titles".
- Don't drop the minimum 5-minute scheduler floor.
