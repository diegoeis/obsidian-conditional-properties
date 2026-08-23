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

**Read these files before changing anything non-trivial. They are the source of truth — these summaries are convenience only.**

### Always applicable

1. **[.claude/rules.md](.claude/rules.md)** — project-wide rules: language, git/tag/changelog flow, "answer before implement" discipline.
2. **[.claude/docs/OBSIDIAN_DEVELOPMENT_POLICIES.md](.claude/docs/OBSIDIAN_DEVELOPMENT_POLICIES.md)** — Obsidian's official **developer policies** (mirror of https://docs.obsidian.md/community-directory/developer-policies). Hard constraints that apply to **both plugins and themes**: no code obfuscation, no dynamic ads, no client-side telemetry, no self-update mechanism, mandatory LICENSE, mandatory README disclosures for network use / payment / accounts / server-side telemetry, fork restrictions, and trademark rules. Any change that touches networking, analytics, the LICENSE, or the README's disclosure sections must be checked against this file. Violations get the project removed from the directory.
3. **[.claude/docs/submission_requirements_for_plugins.md](.claude/docs/submission_requirements_for_plugins.md)** — official plugin-specific submission requirements (mirror of https://docs.obsidian.md/community-directory/submission-requirements-for-plugins): `fundingUrl`/`minAppVersion`/description rules, `isDesktopOnly` for Node/Electron API use, no plugin ID in command IDs, no leftover sample code. Review-bot enforced, not optional.
4. **[.claude/docs/obsidian_plugin_guidelines.md](.claude/docs/obsidian_plugin_guidelines.md)** — official common-review-comments guidelines (mirror of https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines): `this.app` over global `app`, sentence case + heading conventions, `processFrontMatter`/`Vault.process`/`normalizePath` preferences, no default hotkeys, resource cleanup, no `innerHTML`. Recommendations that may still be required depending on severity.
5. **[.claude/rules/obsidian-plugin-rules.md](.claude/rules/obsidian-plugin-rules.md)** — index of task-scoped rule files (generic, portable to any Obsidian plugin repo). Each linked file is short and maps to one concern — load only the one relevant to the current task instead of all of them:
   - [`submission-naming.md`](.claude/rules/submission-naming.md) — plugin ID/name/description, command IDs, `isDesktopOnly`, `fundingUrl`
   - [`memory-lifecycle.md`](.claude/rules/memory-lifecycle.md) — `registerEvent`/`registerInterval`, view references, `onunload()`
   - [`file-vault-api.md`](.claude/rules/file-vault-api.md) — Editor API vs. `Vault.process()`, `processFrontMatter()`, `normalizePath()`
   - [`ui-ux.md`](.claude/rules/ui-ux.md) — sentence case, `.setHeading()`, settings-heading conventions, CSS variables, scoping, no inline/runtime styles
   - [`accessibility.md`](.claude/rules/accessibility.md) — keyboard access, ARIA labels, focus indicators — mandatory, not optional

### Plugin development (this repo)

6. **[.claude/docs/DEVELOPMENT_GUIDELINES.md](.claude/docs/DEVELOPMENT_GUIDELINES.md)** — Obsidian plugin do/don'ts: which APIs to use, lint hot-spots reviewers check, mobile compatibility, testing checklist. Consult **before writing any new Obsidian plugin code** so the plugin keeps passing the community lint.
7. **[.claude/docs/OBSIDIAN_PLUGIN_SUBMISSION_GUIDE.md](.claude/docs/OBSIDIAN_PLUGIN_SUBMISSION_GUIDE.md)** — this repo's own submission and release flow (built on top of items 3–4 above). Consult before every release and every PR against `obsidian-releases`.

This repo is plugin-only — there is no theme-development section or theme doc mirrors here. If a future need arises to reuse this `CLAUDE.md` skeleton for an Obsidian theme repo, bring in `OBSIDIAN_THEME_GUIDELINES.md`/`OBSIDIAN_THEME_SUBMIT.md` mirrors at that point rather than referencing files that don't exist.

### LLM operating rules

When making code or documentation changes to this plugin:

- **Default to the official Obsidian API.** If you're about to use `fetch`, `fs`, `innerHTML`, `localStorage`, `var`, `eval`, manual YAML parsing, the global `app`, or any non-registered listener — stop and consult `DEVELOPMENT_GUIDELINES.md` and `obsidian_plugin_guidelines.md` first. There is almost always an Obsidian-native equivalent.
- **Respect the Obsidian Developer Policies and submission requirements.** Before adding any network call, telemetry, ad, update mechanism, obfuscated code, account-required feature, or anything that reads files outside the vault — check `OBSIDIAN_DEVELOPMENT_POLICIES.md` and `submission_requirements_for_plugins.md`. If the policy requires a README disclosure, add it in the same change. Never insert client-side telemetry or a self-update mechanism, period.
- **Never strip the lint-safe patterns** already in `main.js` (e.g. `createEl`/`createDiv`, `this.register*`, `this.app` never the global `app`, `fileManager.processFrontMatter`, `metadataCache`).
- **Touch the release artifacts together.** If you bump behavior, you also bump `manifest.json` version, add to `versions.json`, append `CHANGELOG.md`, and update the relevant feature section in `README.md` (the README's per-feature version tags, e.g. "new in v0.19.0", are the closest thing this repo has to a feature changelog — keep them accurate).
- **Always confirm with the user before adding a new dependency** (runtime or dev/build tooling) — never add one silently, even if it seems obviously needed.
- **Ask before implementing** if the request is ambiguous or the impact is non-trivial.

### Quick-reference summary

- **Language**: always English (code, commits, docs).
- **Git/release flow**: create the tag only on push; bump `manifest.json` + `versions.json`; tag is `X.Y.Z` (no `v`). For PR conflicts, force-push (don't recreate the branch).
- **Always update on a release-bearing push**: `CHANGELOG.md` and the relevant `README.md` feature section (see note above — `.claude/docs/features-info.md` and `.claude/docs/product/` are referenced by `.claude/rules.md` but don't exist in this repo yet; don't try to open them).
- **Submission**: follow `.claude/docs/OBSIDIAN_PLUGIN_SUBMISSION_GUIDE.md` end-to-end before opening the `obsidian-releases` PR.

## Architecture (where things live in `main.js`)

Single ~2200-line file: class `ConditionalPropertiesPlugin extends Plugin` (rule engine + scan orchestration) plus `ConditionalPropertiesSettingTab extends PluginSettingTab` (all settings UI, including rule/condition/action row builders). No other classes, no imports beyond the `obsidian` package.

- `onload()` — loads settings via `loadData()`, runs `_migrateRules()`, registers the scheduler interval, three commands, and the settings tab.
- Commands (IDs are bare, no `conditional-properties-` prefix — Obsidian auto-namespaces):
  - `run-now` — "Run conditional rules on vault" (`checkCallback`: disabled while a scan is running)
  - `stop-scan` — "Stop running scan" (`checkCallback`: only enabled while a scan is running)
  - `run-current-file` — "Run conditional rules on current file" (`checkCallback`: only enabled when a file is open)
- `runScan()` / `runScanForRules(rulesSubset)` → pick files via `_getFilesToScan()` (respecting `scanScope` + `scanCount`), read frontmatter from `metadataCache.getFileCache(file).frontmatter`, then call `applyRulesToFrontmatter()` per file. Both check `this._cancelScan` between files so `requestStopScan()` lets the in-flight file finish and skips the rest.
- Scan-state pub/sub: `onScanStateChange(callback)` returns an unsubscriber; the settings tab uses it to toggle each rule row's own Run/Stop button and spinner (`_scanStateUnsubscribers`, cleaned up in `hide()`).
- `applyRulesToFrontmatter(file, currentFrontmatter, rulesOverride?)` — for each rule, evaluates `rule.conditions[]` against `rule.match` (`"any"` = OR, `"all"` = AND):
  - Per-condition source value: `_getNoteTitle(file)` for `ifType: "FIRST_LEVEL_HEADING"`, the file/folder name for `ifType: "NOTE_FILE"` (ops: `filenameContains` | `filenameNotContains` | `filenameExactly` | `parentFolderIs` | `parentFolderIsNot`), or `currentFrontmatter[ifProp]` for `ifType: "PROPERTY"`.
  - Condition check: `_matchesCondition(source, expected, op, ifType, propName)` — supports `exactly` | `contains` | `notContains` | `exists` | `notExists` | `isEmpty`, plus regex literals (`/pattern/flags`) for the string ops.
  - `thenActions` dispatch by `action.type`:
    - `"property"` — `action.action`: `add` | `remove` | `overwrite` | `delete` | `rename`. Typed-property coercion (checkbox/date/datetime) happens here via `app.metadataTypeManager`.
    - `"title"` — `action.modificationType`: `prefix` | `suffix` | `overwrite`, text run through `_formatText()`.
    - `"file"` — dispatched to `_applyFileAction(file, fileActionType, rawText, newFm)`; `fileActionType`: `rename` | `addPrefix` | `addSuffix` | `move` | `delete`. `delete` short-circuits the rest of that file's actions (the file no longer exists) — see `_sanitizeFilenameComponent()`/`_sanitizeVaultFolderPath()` for the path-traversal guards these go through before `fileManager.renameFile`/`trashFile`.
  - `_formatText(text, file, fm, dateOnly?)` expands placeholders: `{date}` / `{created_date}` (alias), `{date:FORMAT}`, `{updated_date}`, `{today}`, `{filename}`, `{title}`, `{time}`, and `{propertyName}` (reads `fm`, the in-progress frontmatter). Both single-brace `{x}` and double-brace `{{x}}` forms are supported. `dateOnly: true` (used for Note file actions, since filenames can't hold a full timestamp) forces date-only formatting even for `{today}`/`{updated_date}`.
- Persistence:
  - Title changes via `_updateNoteTitle(file, newTitle)`.
  - Frontmatter via `_writeFrontmatter(file, newFrontmatter)` — uses `fileManager.processFrontMatter` (the official recommended API), creates the YAML block if missing, deletes keys with `null`/`undefined`.

### Settings shape (`loadData()`)
```
rules: Rule[]
scanIntervalMinutes (min 5)
scanScope: latestCreated | latestModified | entireVault
scanCount
operatorMigrationVersion   // current: 3 — see _migrateRules()
```

### Rule shape (current, post-migration-v3)
```
match: "any" | "all"                    // OR / AND across conditions
conditions: Array<{
  ifType: "PROPERTY" | "FIRST_LEVEL_HEADING" | "NOTE_FILE"
  ifProp: string                        // property name; unused for FIRST_LEVEL_HEADING
  ifValue: string                       // ignored for exists/notExists/isEmpty
  op: "exactly" | "contains" | "notContains" | "exists" | "notExists" | "isEmpty"
      // NOTE_FILE narrows op to: "filenameContains" | "filenameNotContains"
      //   | "filenameExactly" | "parentFolderIs" | "parentFolderIsNot"
}>
thenActions: Array<
  { type: "property", prop, value, action: "add"|"remove"|"overwrite"|"delete"|"rename" }
| { type: "title", modificationType: "prefix"|"suffix"|"overwrite", text }
| { type: "file", fileActionType: "rename"|"addPrefix"|"addSuffix"|"move"|"delete", text? }
>
```

`_migrateRules()` upgrades older `data.json` shapes on load (bumping `operatorMigrationVersion` up to 3): pre-v3 rules had a single flat `ifType`/`ifProp`/`ifValue`/`op` instead of `conditions[]` — legacy single-condition rules get wrapped into a one-item `conditions` array with `match: "any"`. When touching migration logic, preserve every prior version's upgrade path; don't just handle the latest shape.

## Development workflow

No build. Edit `main.js` / `styles.css` and reload the plugin in Obsidian.

### Linting

This repo has dev-only tooling to run the same `eslint-plugin-obsidianmd` checks the community-plugin review bot runs on every release — no build step, no TypeScript, just a `package.json` for the lint dependencies:

```sh
npm install   # once, or after pulling a package.json change
npm run lint
```

Config lives in `eslint.config.mjs`. Run this before every release-bearing push, and after any change that touches the settings UI (most `obsidianmd/ui/sentence-case` violations show up there) or adds a new Obsidian API call. `node_modules/` is gitignored; `package-lock.json` is committed so lint results are reproducible.

If a rule flags something that's structurally unavoidable given this repo's no-build/no-TypeScript setup (e.g. `require()` instead of `import`), don't reach for a file-level `/* eslint-disable */` — it hides every other violation in the file, including future ones. Use a scoped `// eslint-disable-next-line <rule> -- <reason>` right above the line, with a comment explaining why. See the top of `main.js` for the existing example.

### Live-test loop via Obsidian CLI

The user keeps the plugin installed in their active vault at `/Users/diegoeis/obs-notes`. To make a code change land in Obsidian without manual clicking, **run the sync script**:

```sh
./scripts/sync.sh
```

This is the project's "F5" — copies `main.js`, `styles.css`, and `manifest.json` into `/Users/diegoeis/obs-notes/.obsidian/plugins/conditional-properties/` and triggers `obsidian plugin:reload id=conditional-properties`. The script lives at [`scripts/sync.sh`](scripts/sync.sh) and is the canonical way to refresh the plugin during development. Override the target with `OBSIDIAN_PLUGIN_DIR=/path/to/other/vault/.obsidian/plugins/conditional-properties ./scripts/sync.sh` when testing in a different vault.

**Run it every time `main.js`, `styles.css`, or `manifest.json` changes during a feature branch.** Without the copy step, the running Obsidian still loads the previous version from the vault. Without `plugin:reload`, the copied files don't take effect until Obsidian restarts.

If you need to do it by hand (e.g. the CLI is unavailable):
```sh
cp main.js styles.css manifest.json /Users/diegoeis/obs-notes/.obsidian/plugins/conditional-properties/
obsidian plugin:reload id=conditional-properties
```
(`obsidian` resolves to `/Applications/Obsidian.app/Contents/MacOS/obsidian`. Confirm the CLI subcommand exists with `obsidian help | grep plugin:`.)

Other helpful CLI commands during dev:
- `obsidian plugins:enabled filter=community` — list enabled community plugins (sanity check).
- `obsidian plugin id=conditional-properties` — show metadata of the currently-loaded version.
- `obsidian dev:errors` / `obsidian dev:console` — pull recent errors / console messages out of Obsidian (use after a reload to triage runtime errors).
- `obsidian vaults` + `obsidian vault` — discover the active vault path if it ever moves.

Recent fixes worth remembering when touching title logic:
- First-level heading detection: detect H1 **only when it appears immediately after YAML frontmatter** (see commit `29ea0bd`). Don't reintroduce broader scanning — it caused false positives.
- Inline title setting must be ignored when checking for H1 existence (commit `2af8ba5`).

## Documentation site (mirrors `.github/workflows/pages.yml`)

The public docs site (linked from the README) is built from `docs-site/` and published via GitHub Pages, using GitHub's "Actions" deployment source (not a `gh-pages` branch, not a `/docs` folder on `main`).

- **Source**: `docs-site/index.md` (Jekyll front matter + Markdown) and `docs-site/_config.yml`. Edit these directly — no local build needed to preview content structure, just push.
- **Workflow**: `.github/workflows/pages.yml` — triggers on push to `main` touching `docs-site/**`, or manually via `workflow_dispatch`. It runs `actions/jekyll-build-pages` (Jekyll runs inside the GitHub-hosted runner — nothing to install locally, no new project dependency), then `actions/upload-pages-artifact` + `actions/deploy-pages`.
- **Published files never live in a branch you can see.** The built site is stored as a Pages deployment artifact, not committed anywhere — `git log` on any branch will never show the rendered HTML.
- **One-time setup required** (not done by this workflow): repo Settings → Pages → Build and deployment → Source → "GitHub Actions".
- Keep `docs-site/index.md` and `README.md` in sync manually when a feature changes — they currently share content but are separate files, not generated from one source.

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
4. Update the relevant `README.md` feature section if user-facing behavior changed.
5. Tag `X.Y.Z` and push. Publish a GitHub Release with the tag to trigger the workflow.

## Things to avoid

- Don't introduce a TypeScript/build pipeline unless explicitly asked — the repo is intentionally source-shipped.
- Don't touch `data.json` as if it were source; it's per-vault user state.
- Don't modify body content of notes — the plugin's contract is "only frontmatter and titles".
- Don't drop the minimum 5-minute scheduler floor.
