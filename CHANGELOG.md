# Changelog

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
