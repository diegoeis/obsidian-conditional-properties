# Changelog

## 0.25.3 - 2026-08-29
### Added
- **Rule search, right under the "Rules" heading.** A condition-type dropdown (Property / First level title / Note file) plus a live-filter search field — typing hides every rule that doesn't have a matching IF condition of that type. For Property, it searches the property name; for First level title and Note file, it searches the condition's typed text. Match is a case-insensitive, literal substring (a `/regex/`-mode condition value is matched as its literal text, slashes included — never interpreted as a pattern), and only kicks in once the term is at least 2 characters. The search field is Obsidian's native search input, with its own built-in clear ("x") button. The filter is session-only — it starts blank every time the settings tab is (re)opened, but stays put across in-tab actions like "Add rule".

## 0.25.2 - 2026-08-29
### Added
- **"Latest export" path shown under Backup and restore.** After clicking "Export settings", the full path of the exported file now appears right below the section description (persisted in settings, so it's still shown after reopening the settings tab or restarting Obsidian). On desktop this is the full OS filesystem path (e.g. `/Users/name/Vault/conditional-properties-settings-2026-08-29.json`), via `FileSystemAdapter.getFullPath()`; on mobile, where there's no real filesystem path to show, it falls back to the vault-relative path.

## 0.25.1 - 2026-08-29
### Fixed
- **Critical: a settings migration bug could silently rewrite `contains` conditions to `exactly`.** `_migrateRules()`'s v0/v1→v2 operator-rename step ran unconditionally whenever `operatorMigrationVersion < 3`, instead of being gated to `< 2` on its own. `contains` has been a valid, current operator (substring match) since 0.12.1 — anyone whose `data.json` was still sitting at `operatorMigrationVersion: 2` (never re-opened Obsidian between 0.12.1 and 0.17.0) would have every genuine `contains` condition silently reinterpreted as `exactly` the next time this ran. Each migration step is now gated to its own version range independently, so a step can never re-run against data from a schema it doesn't apply to. There's no reliable way to detect or repair data already affected by a past run of the old code — this only prevents it from happening going forward. Also fixed in the same function: a missing `await` on the final `saveData()` call, and removed a dead `ifConditions` branch that referenced a field name that never existed in any shipped schema.
- **`onunload()` now stops an in-flight scan.** Previously a no-op — disabling the plugin (or an Obsidian update reloading it) mid-scan let the scan loop keep writing to files after the plugin was gone.
- **`importSettings()` now validates and migrates the imported backup.** A backup with a non-array `rules` field (hand-edited or corrupted) is reset to an empty list instead of reaching `display()` and breaking every rule-iterating code path. The default `operatorMigrationVersion` for a backup missing that field is now `0` (matching a fresh `onload()`), not `2` — so a genuinely old backup goes through every migration step instead of skipping past the v0/v1→v2 one. `_migrateRules()` now also runs immediately after import, instead of leaving an old-schema backup unmigrated until the next Obsidian restart.
- **Dark mode: two hardcoded colors.** `.cp-rule`'s card background was a hardcoded `#fff` (a white card in dark mode); now `var(--background-primary)`. `.cp-rule-remove` / `.extra-setting-button`'s text was hardcoded `#fff` on top of `var(--text-error)`; now `var(--text-on-accent)`, the standard token for text on an accent-colored background.
- **Accessibility: condition/action row labels ("Condition 1", "Action 1") are no longer `<h6>` elements.** A rule with several conditions/actions produced dozens of heading-level elements, which a screen reader's heading-navigation feature lists as if they were real page structure. Now a plain `<div>` — visually identical, since styling was already scoped to the `.cp-rule-label` class, not the tag.
- Two `buttonEl.style.display = "none"` toggles (Stop buttons) replaced with `toggleClass("is-hidden", …)` against the existing `.is-hidden` utility class, instead of runtime inline styles.
- `exportSettings()` now writes through the Vault API (`vault.create` / `vault.process`) with `normalizePath()`, instead of `vault.adapter.write()` with a raw filename — same "just overwrite it" behavior when run twice on the same day, now through Obsidian's own index/events instead of bypassing them.

### Changed
- **The scan-interval field no longer asks for an Obsidian restart.** Changing "Scan interval (minutes)" now clears and restarts the scheduler interval immediately (`_rescheduleScanner()`), debounced to fire once after typing settles, with a single confirmation Notice — instead of a fresh "Interval updated. Restart Obsidian…" Notice on every keystroke that also didn't reflect reality (the old interval kept running until an actual restart).
- **Every free-text settings field now debounces its save** (~400ms after typing stops) instead of writing `data.json` to disk on every keystroke. The settings tab flushes any pending debounced save immediately when closed (`hide()`), so switching away right after typing never drops the last edit.

### Performance
- **`_getNoteTitle()` no longer reads the whole file off disk on the common path.** It now derives the title from Obsidian's already-indexed `metadataCache` (`sections` + `headings`) — zero disk I/O — falling back to a direct disk read only when the cache can't answer yet (e.g. a file just created/changed from outside the editor and not yet re-indexed). That fallback deliberately still uses `vault.read()`, not `cachedRead()` — Obsidian's own docs say `cachedRead()` may return stale content and is meant for display purposes, while `read()` reads straight from disk; since this fallback exists specifically for the moment the cache might be stale, reaching for another potentially-stale source there would defeat the point (confirmed live: with `cachedRead()`, a rule's "no H1" condition could see a stale/empty title microseconds after the file was created and wrongly treat an existing H1 as absent). A rule set with N "First level title" conditions and M title actions previously read the same file N+M times per scan pass; that result is now also memoized for the lifetime of a single `applyRulesToFrontmatter()` call, since it can't legitimately change mid-call (title actions only persist after the whole rule loop finishes).
- **Compiled regex-mode conditions are now cached by raw pattern text**, instead of calling `new RegExp()` for every file a regex-mode condition is checked against. Global/sticky flags (`g`/`y`) are now stripped when compiling — harmless for the single test()/exec() per instance this plugin has always done, but necessary now that instances are reused across files (an uncleared `lastIndex` would otherwise make matches intermittently fail).
- The frontmatter snapshot clone in `applyRulesToFrontmatter()` uses `structuredClone()` instead of a `JSON.parse(JSON.stringify(...))` round-trip.

### Known, deliberately not changed
- `_updateNoteTitle()` (raw content splice via `vault.process`) and `_writeFrontmatter()` (`fileManager.processFrontMatter`) still run as two separate read-modify-write cycles when both a title and a property change in the same scan pass. Unifying them into one `vault.process()` call would mean hand-serializing YAML instead of going through `processFrontMatter` — this repo's rules explicitly forbid manual YAML parsing/writing (`.claude/rules.md` Rule 6), so this stays as two writes.
- `getSettingDefinitions()` (Obsidian's newer declarative settings API, needed for this plugin's settings to appear in Obsidian 1.13+'s in-app settings search) is a larger structural change than fits alongside this fix set — tracked as a follow-up, not implemented here.
- `_getFilesToScan()`'s full-vault sort (to then take the first N for "latest created/modified" scope) and per-action `_getPropertyType()` lookups are minor, lower-impact than the fixes above — left as-is for now.

## 0.25.0 - 2026-08-29
### Added
- **"Bookmark file" and "Remove bookmark" Note file THEN actions.** "Bookmark file" adds the file to Obsidian's core Bookmarks plugin, with a group dropdown populated from your existing bookmark groups (including nested ones, shown as `Parent/Child`) or "No group (top level)". "Remove bookmark" removes the file's bookmark wherever it exists in the tree. Both are no-ops when the desired state already holds (already bookmarked in that exact group, or not bookmarked at all), so a rule can run repeatedly without piling up duplicates. Requires the core Bookmarks plugin to be enabled — if it's disabled, the group dropdown is empty and the action is silently skipped (logged to the console) rather than failing the scan, since Bookmarks has no public API (undocumented internal state, same category as the existing `metadataTypeManager` usage in this file).

## 0.24.2 - 2026-08-24
### Changed
- **Settings tab UI rebuilt on native Obsidian patterns.** The DOM is now batched off-document and attached once instead of inserting each row live (fixes lag when opening the tab with many rules), wrapped in Obsidian's own setting-group/setting-items shell, and every `conditional-*` CSS class renamed to `cp-*` under one shared row shape. No behavior change — same rules, same fields, same commands.
- **Documentation rewritten to mirror the settings screen exactly.** Every condition/action example across `README.md` and the docs site now uses the literal dropdown labels in the literal field order shown on screen (e.g. `Property: status → exactly match → "done"` instead of the previous shorthand `property: status exactly "done"`), instead of an invented pseudo-syntax. Also fixed: the manual-install path (`.obsidian/plugins/conditional-properties`, not `.../obsidian-conditional-properties`), a missing note that Note file conditions don't have `exists`/`does not exist`/`is empty`, and the claim that `{{date}}`/`{{time}}` always default to `YYYY-MM-DD`/`HH:mm` (they follow the vault's configured Date/Time format when one is set).
- **Placeholder documentation and settings-field hints now double-brace only** (`{{date}}`, `{{propertyName}}`, …). The single-brace form (`{date}`, etc.) still works in existing rules for backward compatibility, but is no longer shown or described anywhere — new and existing users only see one syntax.

## 0.24.1 - 2026-08-23
### Changed
- **Renamed "First level heading" (IF) and "First heading" (THEN) to "First level title"**, on both sides, for a consistent name. This is a UI label change only — the underlying `ifType: "FIRST_LEVEL_HEADING"` and `action.type: "title"` values stored in existing rules are unchanged, so no migration is needed and existing rules keep working exactly as before.

## 0.24.0 - 2026-08-22
### Added
- **Regular expression matching in IF conditions**, using the same `/pattern/` convention as [Obsidian's Web Clipper URL-trigger patterns](https://help.obsidian.md/web-clipper/triggers#Regular+expression+matching): wrap a value in forward slashes to opt "exactly match", "contains", and "does not contain" into a regex test instead of a literal string comparison. Works on **Property**, **First level heading**, and **Note file** (filename) conditions — not on `Parent folder is` / `Parent folder is not`, which stay literal path matching. Example: a "First level heading" condition with `contains` and value `/\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])/` matches a title like "Nota da reunião 2026-08-22 com John Doe". Standard JS regex flags are supported as a suffix, e.g. `/report/i`.
- A malformed pattern (or unknown flag) never crashes a scan: it's treated as "does not match" (fail closed), logged via `console.error`, and surfaced once per unique broken pattern via `Notice` (deduped so a full-vault scan doesn't spam one Notice per file).
- **A hint appears under a condition's value field** when the typed text looks like a regular expression (`\d`, `(?:`, `{4}`-style quantifiers, `[a-z]`-style character classes, …) but is missing its `/slashes/` — a one-line nudge instead of a silently-ignored pattern.
- **🧪 Beta: `{{match}}` / `{{match:N}}` / `{{match:name}}` — reuse the IF regex's match in THEN actions.** Available in property values, title actions, and Note file actions (rename/prefix/suffix/move). `{{match}}` is the full matched text, `{{match:1}}`/`{{match:2}}` are numbered capture groups, `{{match:name}}` is a named group from `(?<name>...)`. Reads from the first regex-mode condition (in declared order) that was the reason the rule matched. Not yet supported for a list-valued `Property` condition (e.g. `tags`) — no single scalar to capture from. Double-brace only, per the "new placeholders ship `{{}}`-only" convention below — no `{match}` single-brace form exists or is planned.
- **Double-brace placeholder syntax, matching [Obsidian's own Templates plugin](https://obsidian.md/help/plugins/templates)**: `{{date}}`, `{{date:FORMAT}}`, `{{time}}`, `{{time:FORMAT}}`, `{{title}}` now work everywhere placeholders do, alongside the existing single-brace syntax (`{date}`, `{filename}`, etc). Both styles are fully interchangeable and can be mixed in the same value.
- **New placeholder: `{time}` / `{{time}}`** — current time, default format `HH:mm` (or the vault's configured time format), with `:FORMAT` support (e.g. `{{time:HH:mm:ss}}`).
- **New placeholder: `{title}` / `{{title}}`** — alias of `{filename}`, matching Obsidian's own `{{title}}` meaning (the note's name).
- **One deliberate semantic difference, clearly documented**: `{date}` (single brace) keeps its original meaning — the file's **creation date** — for backward compatibility, since it shipped before double-brace support existed. `{{date}}` (double brace) means **today's date**, matching what `{{date}}` means everywhere else in Obsidian. Every other reserved name (`created_date`, `updated_date`, `today`, `time`, `title`, `filename`) means the same thing in both syntaxes — this divergence is unique to `date`.
- `{{propertyName}}` (double-brace frontmatter property lookup) also works now, same behavior as the existing `{propertyName}`.

### Fixes
- **"Run this rule" no longer makes every other rule's row look like it's running too.** Each row's "Run this rule" button and its Stop button were reacting to the same global scan-in-progress flag every other row also shares (needed so only one scan runs at a time) — so clicking one rule's button lit up the spinner and Stop button on every rule, and on the top "Run now" button, even though only the clicked rule's conditions/actions were actually being evaluated. Every other row now shows correctly as disabled (can't start a second scan) but no longer shows a spinner or a Stop button it doesn't control.

## 0.23.6 - 2026-08-22
### Fixes
- **Reverted the ":" stripping added in 0.23.5.** That change stripped `:` from Note file action text unconditionally, which also broke an explicitly-typed value — if you deliberately type `{today:HH:mm}` (or any literal `:`) into Rename/Prefix/Suffix/Move file to, it's now honored exactly as typed again. Only the *default* (no explicit `:FORMAT`) date placeholder is forced to `YYYY-MM-DD` — that part of 0.23.5 is unchanged. The plugin never second-guesses explicit user input, only fills in a sane default when none was given.

## 0.23.5 - 2026-08-22
### Fixes
- **Note file actions (Rename / Add prefix / Add suffix / Move file to) now always resolve a bare date placeholder (`{today}`, `{date}`, `{created_date}`, `{updated_date}`) to `YYYY-MM-DD`**, ignoring the vault's configured default date format. File and folder names can't contain a time component (`:` is invalid on Windows, reserved on macOS), so these fields no longer inherit whatever format is configured for properties/titles elsewhere. An explicit `{today:FORMAT}` is still honored as typed.
- Defense-in-depth: the filename/folder-path sanitizers now also strip `:` from the formatted text, so even an explicit user-typed format containing time (e.g. `{today:HH:mm}`) can't produce an invalid path.

## 0.23.4 - 2026-08-22
### Added
- **New "Note file" IF operator: "Parent folder is not"** — the exact inverse of `Parent folder is`. Same folder-name-or-partial-path matching (contiguous, in-order segments anywhere in the file's folder path, case-insensitive), opposite result. An empty value makes it always match (and makes `Parent folder is` never match) — same convention as the `does not contain` operator elsewhere in the plugin. Useful to exclude one folder from an otherwise broad rule.

## 0.23.3 - 2026-08-22
### Changed
- Renamed the THEN action **"Move file"** to **"Move file to"** for clarity.
- Documented that `Move file to` auto-creates the destination folder when it doesn't exist yet — this already worked, but nothing told users it was safe to point the action at a folder that doesn't exist. README now has a dedicated example combining it with `{today}` to sort files into a fresh dated folder on each run.

## 0.23.2 - 2026-08-22
### Added
- **Local lint tooling**: `npm install && npm run lint` now runs `eslint-plugin-obsidianmd` against `main.js` — the same checks the community-plugin review bot runs on release. Dev-only `package.json`/`package-lock.json`/`eslint.config.mjs`; no build step, no runtime dependencies added.

### Fixes
- **Removed the file-level `/* eslint-disable */`** that was silencing lint on the entire file. Fixed every real violation it had hidden: sentence case on 15 UI strings (dropdown options, placeholders, button labels, Notices), `element.style.display` direct assignment (now a `toggleClass('is-hidden', …)` like the rest of the settings UI), an unused `catch (e)` binding, and a dead `parseYaml`/`stringifyYaml` import (frontmatter I/O has used `fileManager.processFrontMatter` since day one). The two remaining structural findings — `require()` instead of `import`, and destructuring a variable named `Plugin` that collides with a legacy browser global — are inherent to this repo's hand-written-CommonJS-no-build architecture; they're now suppressed with a scoped, documented `eslint-disable-next-line` instead of hiding everything.
- **Documented three internal/undocumented Obsidian API usages** (`vault.config.dateFormat`, `metadataTypeManager`, `internalPlugins`) as known tech debt with inline comments — no public alternative exists today, but the file previously gave no signal that these could silently break on an Obsidian update. All three were already wrapped in try/catch with safe fallbacks.
- **Export settings no longer relies on a synthetic `<a download>` click on a Blob URL** — that pattern isn't reliable in mobile WebViews (the manifest declares `isDesktopOnly: false`). It now writes directly into the vault via `vault.adapter.write` and shows a `Notice` with the file's path.
- **A rule's `PROPERTY` condition now sees property changes made by earlier rules in the same scan**, not just the frontmatter snapshot from before the scan started — matching how THEN actions already read from the in-progress frontmatter. Lets rules chain in a single pass (see the new "Rule Chaining Within a Scan" section in the README) instead of needing a second scheduled run to pick up an earlier rule's change.
- Corrected two stale CLAUDE.md references to `parseYaml`/`stringifyYaml` as the frontmatter-writing mechanism — it's been `fileManager.processFrontMatter` since the rewrite; the docs just hadn't caught up.

## 0.23.1 - 2026-08-22
### Fixes
- **Note file actions could escape the vault via path traversal.** `Rename file` / `Add name prefix` / `Add name suffix` did not strip `/`, `\`, or `..` from the (possibly placeholder-expanded) text, so a value like `../outside/name` could compute a path outside the file's current folder. `Move file` only trimmed leading/trailing slashes and did not reject `..` segments, so a destination like `../../outside` could resolve above or outside the vault root. Both are now sanitized before any `renameFile`/`createFolder` call: rename/prefix/suffix strip path separators and `..` entirely (filename-only, never changes folder), and Move drops `.`/`..`/empty path segments (vault-relative only, confined inside the vault).

## 0.23.0 - 2026-08-22
### Added
- **New THEN action type: "Note file"** — change the file itself instead of a frontmatter property or the H1 title. Five actions:
  - `Rename file` — replaces the entire filename (extension kept). Empty text → skipped, the rest of the rule's actions still run.
  - `Add name prefix` / `Add name suffix` — prepend/append text to the current filename. Empty text is a no-op.
  - `Move file` — moves the file to a vault-relative folder path, creating the folder if missing. Empty text → skipped. Moving outside the vault isn't supported — the plugin API has no access beyond the vault sandbox.
  - `Delete file` — sends the file to trash via `fileManager.trashFile`, respecting the user's configured deletion behavior (system trash / `.trash` folder / permanent).
  - All rename/prefix/suffix/move actions use `fileManager.renameFile` (not `vault.rename`), so links to the file elsewhere in the vault stay updated.
  - All text fields support the existing placeholders (`{date}`, `{created_date}`, `{updated_date}`, `{today}`, `{filename}`, `{propertyName}`).
  - Multiple file actions in the same rule execute immediately and compose in sequence (e.g. prefix then move sees the already-renamed file).
  - A `Delete file` action stops all further actions/rules for that file in the current scan.

## 0.22.0 - 2026-08-22
### Added
- **New IF condition type: "Note file"** — check the file itself instead of a frontmatter property or the H1 title. Four operators:
  - `Filename contains` / `Filename not contains` / `Filename exactly match` — compare against the file's basename (no extension), case-insensitive.
  - `Parent folder is` — accepts a single folder name (`ClienteA`) or a partial path (`meetings/transcripts/company`). Matches when those segments appear contiguous and in order anywhere in the file's folder path, not only as the immediate parent and not anchored at the vault root. Case-insensitive.

## 0.21.0 - 2026-08-22
### Added
- **New text placeholders for property values and title actions**: `{created_date}` (alias of `{date}` — the file's creation date, `file.stat.ctime`), `{updated_date}` (the file's last-modified date, `file.stat.mtime`), and `{today}` (the current date at the moment the rule runs, independent of the file). All three support the `:FORMAT` suffix, same as `{date}` (e.g. `{updated_date:DD-MM-YYYY}`).
- `{date}` keeps its existing meaning (creation date) unchanged — no behavior change for existing rules.

## 0.20.4 - 2026-06-18
### Fixes
- **No more scroll-to-top or lag on any settings interaction.** Every remaining `this.display()` call inside the settings UI has been replaced by a localized DOM mutation:
  - Changing the **Scan scope** no longer rebuilds the page — the "Notes to scan" row is now created once and toggled via an `is-hidden` class.
  - **Add rule** appends the new rule's `wrap` right after the Add button instead of re-rendering all rules.
  - Changing a condition's **Property / First level heading** type, or its **operator**, rebuilds only that single condition row in place.
  - Changing an action's **Property / First heading** type, or its **action** (add / overwrite / delete / rename / …), rebuilds only that single action row in place.

  The only `display()` left in the settings UI is on **Import settings**, where rebuilding the whole tab is the right thing to do (every field potentially changed).

### Internal
- Eliminated dead code (`_updateValueInputState`, never called).
- Removed the unused `ruleIdx` parameter from `_renderThenAction` and call sites.
- Translated lingering Portuguese comments to English (or removed them when they only restated the code).
- Replaced fragile class-based DOM lookups (`.extra-setting-button`, `.conditional-match`, `.setting-item-name`) with explicit references on `ruleCtx`:
  - `ruleCtx.matchWrapEl` — the Match dropdown element, `null` when absent.
  - `ruleCtx.removeBtnByCondition` — `WeakMap<Setting, HTMLElement>` mapping each condition's `Setting` instance to its ✕ button element.
  - `ruleCtx.actionEntries` — array of `{ el, setting }` per action row, so reindexing and rebuilds use the `Setting` instance directly instead of querying the DOM by class.
- Added `_rebuildCondition(ruleCtx, cond)` and `_rebuildAction(ruleCtx, action)` to encapsulate the "this row's shape changed, redraw just this row" path that used to be a full `display()`.
- Added an `is-hidden` utility class in `styles.css` so visibility toggles stay in CSS instead of being scattered as inline `style.display = '…'` assignments.

## 0.20.3 - 2026-06-18
### Fixes
- **The rule-level Remove button no longer scrolls or lags either.** The same `display()` call that 0.20.1 and 0.20.2 eliminated for rows was still firing when an entire rule was removed. The rule's `wrap` element is now detached in place; the other rules stay exactly where they were on screen.

### Internal
- The Remove handler unsubscribes the rule's `onScanStateChange` listener and prunes it from `_scanStateUnsubscribers` before detaching the DOM, so removed rules don't leave dangling subscribers behind.
- Both `Run this rule` and `Remove` resolve the rule's current index via `Array#indexOf(rule)` at click time instead of trusting the `idx` captured at render time. With re-renders gone, the closure-captured index would go stale after any other rule was removed and we'd run / delete the wrong one.

## 0.20.2 - 2026-06-18
### Fixes
- **Removing a condition or action no longer scrolls or lags.** Same root cause as 0.20.1 — the per-row Remove (✕) button still called `display()`, which destroyed and rebuilt the entire settings tab. Now the removed row's DOM is detached in place; the remaining rows are reindexed (`Condition 1`, `Condition 2`, …) via the `Setting` instance, and when a rule drops back to a single condition the `Match (any/all)` dropdown and the last Remove ✕ are stripped without re-rendering.

### Internal
- Introduced a per-rule `ruleCtx` object (`{ wrap, ifHeader, rule, conditionSettings, actionWraps }`) shared between `_renderRule`, `_renderCondition`, `_renderThenAction`, `_addConditionRemoveButton`, and `_ensureMatchDropdown`. Remove handlers mutate this context instead of falling back to a full re-render.
- Condition rows are tracked as `Setting` instances so `setName()` is enough to reindex; action wraps are tracked as their root elements and reindexed via a scoped `querySelector` for `.setting-item-name`.

## 0.20.1 - 2026-06-18
### Fixes
- **"+ Add condition" and "+ Add action" no longer scroll the settings tab to the top.** Previously each click re-rendered the entire settings UI via `display()`, which destroyed and recreated every rule and reset the scroll position — making it impossible to keep your eyes on the rule you were editing. The new condition/action is now appended in place, right above its "Add" button.
- **New conditions/actions appear instantly.** The full re-render was also responsible for the lag — every existing rule, condition and action was being rebuilt on each click. Only the new row is created now.
- The `Match (any/all)` dropdown is materialized on the fly the first time a rule gets a second condition, and the per-condition Remove button is wired into the previously-single condition at the same moment — no element is destroyed and recreated.

### Internal
- `_renderCondition()` and `_renderThenAction()` now return the elements they create (the `Setting` and the wrap `div`), so callers can insert them at a precise position without resorting to `lastElementChild` or DOM scraping.
- New helpers `_ensureMatchDropdown(ifHeader, rule)` and `_addConditionRemoveButton(settingLine, rule, cond)` extract the dynamic-mutation logic. The Remove handler looks up the condition's current index via `Array#indexOf` instead of capturing it in a closure, so removals stay correct after subsequent additions.
- Remove handler for actions does the same `indexOf` lookup, fixing a latent off-by-one when an action is deleted after another was appended.
- All DOM lookups remain scoped to elements the plugin owns (`settingEl.querySelector(...)`, `ifHeader.querySelector(...)`); no global `document.querySelector` was introduced. No `innerHTML`, `var`, or unregistered listeners were added — Obsidian's `createEl` / `createDiv` and the `Setting` / `DropdownComponent` / `ButtonComponent` APIs are used throughout, in line with the project's plugin guidelines.

## 0.20.0 - 2026-05-19
### New Features
- **Frontmatter property placeholders in THEN values.** Any `{propertyName}` reference inside a THEN action's value (property add/overwrite/remove, title prefix/suffix/overwrite) is now expanded to the live value of that frontmatter property on the note being processed. Example: an action `Property excerpt = Add value {g_excerpt}` copies the contents of `g_excerpt` into `excerpt`.
- **Missing properties expand to an empty string** — no error, no literal `{name}` left behind.
- **Array values are joined with `, `** so a multi-valued source like `tags` produces a readable string.
- The reserved placeholders `{date}`, `{date:FORMAT}`, and `{filename}` keep their existing meaning; they're resolved first and never collide with property lookups.

### Internal
- `_formatText(text, file)` now takes an optional third argument `fm` (the in-progress frontmatter snapshot). All four call sites inside `applyRulesToFrontmatter` pass `newFm`, so a later action in the same rule sees the writes performed by earlier actions. When `fm` is omitted, the helper falls back to `metadataCache.getFileCache(file).frontmatter`.
- Placeholder resolution is now a two-pass replace: pass 1 handles `{date}`/`{filename}`; pass 2 treats any other `{name}` token as a frontmatter lookup. The pass-2 regex excludes `:` and whitespace, so a malformed `{date:FORMAT}` survivor would not be mistaken for a property name.

### Why
Users storing canonical content in one property (`g_excerpt`, `g_title`, `summary`, ...) and needing to project it onto another (`excerpt`, `description`, ...) previously had to copy by hand. This closes that gap without inventing a new action type — the existing add/overwrite/title actions just gained a richer expansion grammar.

## 0.19.1 - 2026-05-17
### New Features
- **Typed-property coercion now also runs on the IF side.** Previously, the type-aware normalization shipped in v0.19.0 only applied to THEN actions (writing the YAML). It now also runs when matching IF conditions against `checkbox`, `date`, and `datetime` properties, for the `exactly`, `contains`, and `notContains` operators.
- You can now author rules like `IF property: created_at exactly "08-08-2025"` and have them match a note storing `created_at: 2025-08-08`. The plugin normalizes the user-typed value through the same Daily Notes / Templates / common-fallbacks pipeline used by the THEN side, then compares against the ISO value in YAML.
- Checkbox conditions like `IF property: done exactly "true"` match a note with the boolean `done: true` (case-insensitive on the typed value).

### Internal
- `_matchesCondition` gained a fifth parameter `propName`. When `ifType` is `"PROPERTY"` and the property's widget is `checkbox`/`date`/`datetime`, the helper coerces `expected` through `_coerceValueForProperty` before normalization. All other operators and property types pass through unchanged.
- No new helpers — `_getPropertyType`, `_coerceValueForProperty`, `_normalizeDateInput`, and `_getDateFormatCandidates` are reused verbatim from v0.19.0. The IF and THEN sides share the same source of truth.

### Why
A natural follow-up to v0.19.0: typing on the THEN side was already type-aware, but the IF side was still doing literal string comparison. Author rules in whatever date format you prefer; the plugin handles the conversion.

## 0.19.0 - 2026-05-17
### New Features
- **Typed-property awareness for `checkbox`, `date`, and `datetime`**: when a rule's target property is registered with one of these widgets in the Obsidian property type system, the plugin now writes the value with the correct YAML type so the native widgets render. Closes part of issue #11.
- **Checkbox**: rule values like `"true"` are written as the boolean `true` (no quotes) — Obsidian renders a real checkbox instead of plain text. `"true"` is matched case-insensitive; anything else (including empty) writes `false`.
- **Date**: rule values are normalized to `YYYY-MM-DD` before being written. If the input is already ISO, it's used directly. Otherwise the plugin tries the Daily Notes core plugin's date format (if enabled), then the Templates core plugin's date format (if enabled), then `DD-MM-YYYY`, `DD/MM/YYYY`, and `YYYY/MM/DD` in that order. `MM-DD-YYYY` is intentionally excluded to avoid silently mis-parsing non-US date inputs. The first strict match wins.
- **Datetime**: input is trimmed and written as-is. No format conversion since Daily Notes and Templates only expose date formats.
- **`add` collapses into `overwrite` for typed scalar properties** (checkbox / date / datetime). You can't meaningfully `add` to a scalar field, so the action transparently overwrites instead of turning the value into a `[a, b]` array.

### Bug Fixes
- The internal `_writeFrontmatter` helper used to treat both `null` and `undefined` as "delete this property". It now only deletes on `undefined` (the sentinel used by the `delete` and `rename` actions). `null` is preserved as-is. No user-facing behavior changes today, but the contract is now safe for future code paths that legitimately want to write a `null` value.

### Internal
- New helpers `_getPropertyType(name)`, `_coerceValueForProperty(name, raw, type)`, `_getDateFormatCandidates()`, and `_normalizeDateInput(raw)`. Property type lookup prefers `getPropertyInfo(name).widget` over `getAssignedWidget(name)` because the former includes inferred types (used when the property exists in the vault but the user never explicitly set a type in Settings → Properties).

### Why
Issue #11 from @KenCrandall asked how to write checkbox and date property values, observing that whatever value he typed ended up as a string in the YAML. The plugin was writing everything as a string regardless of the property's registered widget, which broke the native renderers. This release fixes the checkbox half of that issue and the date half; datetime is supported as a passthrough (no format inference).

## 0.18.0 - 2026-05-17
### New Features
- **Stop button for running scans**: clicking "Run now" or "Run this rule" now keeps the original button visible (in a disabled / loading state) and reveals a red **Stop** button next to it. Clicking Stop finishes the file currently being processed (so frontmatter is never left in a half-written state) and skips every remaining file in the queue.
- **`Stop running scan` command in the command palette**: hidden when idle, visible only while a scan is in progress. Same semantics as the in-UI Stop button.
- The completion notice now reports `stopped` runs explicitly, e.g. `Conditional Properties: 5 modified / 6 scanned — stopped (skipped 94 of 100)`.

### Internal
- New plugin-level flags `_scanRunning` / `_cancelScan` and helper methods `isScanRunning()`, `requestStopScan()`, `onScanStateChange(cb)`. Each scan iteration in `runScan` / `runScanForRules` checks `_cancelScan` before starting the next file and breaks out cleanly if requested.
- Settings tab subscribes to `onScanStateChange` so both Run buttons (vault-wide and per-rule) flip between idle/running automatically without re-rendering the whole tab.
- A lightweight pub/sub (`_scanStateListeners`) replaces relying on Obsidian's `Plugin.trigger` to avoid colliding with the framework's own event names.

### Out of Scope
- Scheduler runs (automatic every-N-minutes) are still unstoppable from the UI — they have no surface to show a Stop button. If a scheduler run is in progress and the user triggers a manual run, the manual run is rejected with a "busy" notice (no double execution).
- The `Run conditional rules on current file` command remains uninterruptible because a single-file run is effectively atomic already.

## 0.17.0 - 2026-05-16
### New Features
- **Multiple conditions per rule (any/all)**: each rule now supports a flat list of conditions and a `Match any of the following` / `Match all of the following` selector at the top of the IF block. Replaces the old workaround of using temporary properties to simulate AND/OR. Inspired by Zotero's "match any/all of the following" UI. Tracked in FRD-001 v2.0.
- **`+ Add condition` button**: appended to the IF block, lets the user add an arbitrary number of conditions per rule. Each condition keeps the existing layout (PROPERTY / FIRST_LEVEL_HEADING + operator + value, with the value field hiding for `exists` / `notExists` / `isEmpty`).
- **Per-condition remove (`×`)**: each condition gets a remove button when more than one is present. When the rule is back to a single condition, the match dropdown auto-hides.

### Migration
- **Automatic, one-time migration** from the legacy single-condition shape to the new `{ match, conditions: [...] }` shape. Migration version bumps from 2 to 3 inside `_migrateRules()` and is idempotent.
- **All legacy rules default to `match: "any"`**. Because there is exactly one condition, behavior is bit-for-bit identical to v0.16.3 until the user adds a second condition.
- **`data.backup.json` is written next to `data.json` in the plugin folder before the migration writes anything**, so the user can recover the pre-v0.17.0 settings by copying it back if needed. Only one backup is kept (overwrites the previous one).
- **Downgrade is not supported** after the first v0.17.0 load. Older plugin versions don't understand `conditions[]` and will silently ignore the new rules.

### Internal
- New helper `_writeMigrationBackup()` uses `app.vault.adapter` to copy `data.json` to `data.backup.json` synchronously before the migration mutates `this.settings`.
- New helper `_renderCondition()` encapsulates the condition row UI (previously inlined in `_renderRule`). `_renderRule` is now ~30 lines shorter.
- `applyRulesToFrontmatter` now evaluates an array of conditions with short-circuit semantics (`every` for `all`, `some` for `any`). The single-condition fast-path is just `conditions.length === 1`, no special-casing.
- THEN block (`thenActions`) is **unchanged**. No new operators, no new actions, no new placeholders.

### Why
Community demand (issue from @nanjingman with Zotero mockup, plus issue #9 from @dimayan4enko). The original FRD-001 (Jan 2026) had marked full AND/OR/NOT logic as "do not implement" because it scoped the worst case (nested groups, NOT-per-group, boolean expression parser, ~1000 lines). Cutting the scope to the Zotero "any/all of the following" model with a flat list of conditions delivers ~95% of the value in ~200 lines, with trivial migration and zero impact on the THEN block. See [.claude/docs/product/frd-001-multiple-conditions-boolean-logic.md](.claude/docs/product/frd-001-multiple-conditions-boolean-logic.md) for the full rationale.

## 0.16.3 - 2026-05-16
### Improvements
- **README**: removed "(Coming Soon)" placeholder from the Community Plugins install section; the plugin is published, so the placeholder no longer applies.
- **Roadmap**: marked the rename-property action and the title overwrite / `{filename}` / `{date:FORMAT}` placeholders as shipped (they landed in v0.16.0 and v0.15.0 respectively and were still showing as pending).
- **styles.css**: removed all `!important` declarations in the active stylesheet and replaced shorthand hex `#fff` with the full 6-digit `#ffffff`. The red-button variant now wins through selector specificity (`#eis-cp-plugin button.eis-btn.eis-btn-red`) instead of `!important`, and the hover color reuses the `--text-on-accent` CSS variable. Cleared the warnings reported by the community CSS lint at `styles.css:78–80` and `styles.css:100`.
- **Release workflow**: now uploads `main.js`, `styles.css`, `manifest.json`, `versions.json`, the zip, and `LICENSE` individually to the GitHub Release (previously only the zip and manifest were attached, which made the LICENSE file invisible to release-asset validators).
- **Artifact attestations**: the release workflow now generates GitHub artifact attestations for `main.js`, `styles.css`, and `manifest.json` via `actions/attest-build-provenance@v2`, so users can cryptographically verify the release came from this repo. Required adding `id-token: write` and `attestations: write` to the workflow permissions.

### Why
Hygiene release driven by the community-plugin validator: the previous release was flagged for unfilled README placeholders, `!important` / 3-digit hex in `styles.css`, and missing artifact attestations. No runtime behavior changed.

## 0.16.2 - 2026-02-02
### Breaking Changes
- **H1 detection now only considers headings immediately after YAML frontmatter**: The plugin now only checks for H1 headings that appear at the beginning of the content, right after the YAML frontmatter. H1 headings elsewhere in the document are ignored.
- This ensures consistent behavior where the "title" of a note is always the first H1 after frontmatter, not random H1s scattered throughout the document.

### Bug Fixes
- Fixed `notExists` and `isEmpty` operators to correctly identify files without a title H1
- Plugin no longer considers H1 headings in the middle or end of documents as the "title"

### Technical Details
- `_getNoteTitle()` now reads file content directly and checks only for H1 immediately after YAML
- `_updateNoteTitle()` ensures H1 is always placed/updated right after YAML frontmatter
- Removed dependency on MetadataCache.headings to avoid false positives from H1s elsewhere in the document

## 0.16.0 - 2026-01-12
### New Features
- **RENAME property action**: New action to rename properties while preserving their values. Use "Rename property to" option in THEN actions to change property names (e.g., rename `old_company` to `company`)

### Improvements
- Case-insensitive property name matching for rename operations
- Automatic protection against overwriting existing properties during rename
- Clean removal of old property after successful rename

## 0.15.0 - 2026-01-08
### New Features
- **OVERWRITE TO option for title modification**: Completely replace note titles instead of just adding prefix/suffix
- **{filename} placeholder**: New placeholder that inserts the file's basename (without .md extension)
- **Combined placeholders**: Mix {date}, {date:FORMAT}, and {filename} in any order (e.g., `{date:YYYY-MM-DD} - {filename}`)
- **Auto-create H1 headings**: When using `notExists` or `isEmpty` operators with FIRST LEVEL HEADING, the plugin now creates H1 headings automatically
- **Improved UI**: Text input field now hides automatically when using `exists`, `notExists`, or `isEmpty` operators

### Bug Fixes
- Fixed issue where rules with `notExists` or `isEmpty` operators on FIRST LEVEL HEADING were being skipped
- Fixed `isEmpty` operator returning false for non-existent headings instead of true
- Fixed OVERWRITE TO not working when H1 heading doesn't exist

### Improvements
- OVERWRITE TO now properly handles notes without H1 headings
- Frontmatter `title` property remains untouched (plugin only modifies H1 headings)
- Better operator handling for FIRST LEVEL HEADING conditions

## 0.1.0 - 2025-10-13
- Initial release
- Rules engine with operators (equals/contains/notEquals)
- Run on vault and current file
- Scheduled scans (min 5 minutes)
- Settings UI and Run now button
- Multi-value property handling
