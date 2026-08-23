# Conditional Properties 0.24.0

This release bundles everything accumulated since the last published version (0.20.4): new placeholders, a full "Note file" condition/action system, and regex matching in IF conditions with a beta way to reuse the match in THEN.

## Highlights

### 🔍 Regex matching in IF conditions (new)
`Property`, `First level heading`, and `Note file` (filename) conditions now accept a value wrapped in forward slashes — `/pattern/flags` — to match with a regular expression instead of a literal string, using the same convention as [Obsidian's Web Clipper URL-trigger patterns](https://help.obsidian.md/web-clipper/triggers#Regular+expression+matching). Standard JS flags are supported (`/report/i`, `/^draft/m`). A malformed pattern never crashes a scan — it's treated as "does not match" and reported once via `Notice`. The settings UI also nudges you with a hint if your typed value looks like a regex but is missing its `/slashes/`.

### 🧪 Beta: `{{match}}` in THEN actions
Reuse whatever your IF regex matched, instead of retyping the pattern on the THEN side — `{{match}}` (full match), `{{match:1}}` / `{{match:2}}` (numbered capture groups), `{{match:name}}` (named groups via `(?<name>...)`). Works in property values, title actions, and Note file actions (rename/prefix/suffix/move). Example:
```yaml
IF Note file: Filename contains → /\d{4}-\d{2}-\d{2}/
THEN Note file: Move file to → transcripts/{{match}}
```
Marked beta: only supported for scalar `Property`, `First level heading`, and `Note file` conditions today — not for list-valued properties like `tags`.

### 📁 Note file conditions & actions (0.22.0 – 0.23.6)
A whole new way to target rules at the file itself rather than its frontmatter or title:
- **IF Note file**: `Filename contains` / `not contains` / `exactly match`, `Parent folder is` / `Parent folder is not` (partial-path matching, e.g. `meetings/transcripts/company`).
- **THEN Note file**: `Rename file`, `Add name prefix`, `Add name suffix`, `Move file to` (auto-creates the destination folder), `Delete file` (stops all further processing for that file). All chain in sequence within one rule.
- Path traversal hardened: any placeholder-expanded text going into a filename or folder path is sanitized against `../` escaping the vault.

### 🔤 Double-brace placeholders (0.24.0)
`{{date}}`, `{{date:FORMAT}}`, `{{time}}`, `{{time:FORMAT}}`, `{{title}}`, `{{propertyName}}` — matching [Obsidian's own Templates syntax](https://obsidian.md/help/plugins/templates) — now work everywhere the original single-brace placeholders do, and both styles can be mixed freely. One deliberate difference: `{date}` keeps meaning the file's *creation date* (its original, pre-0.24.0 meaning) while `{{date}}` means *today's date*, matching what `{{date}}` means everywhere else in Obsidian.

**Going forward, new placeholders ship double-brace only** — `{{match}}` is the first one with no legacy `{match}` form.

### 🗓️ More date placeholders (0.21.0)
`{created_date}` (alias of `{date}`), `{updated_date}` (file's last-modified date), `{today}` (current date, independent of the file) — all support the `:FORMAT` suffix.

## Fixes
- "Run this rule" no longer shows every other rule's row as running too — each row's spinner/Stop button now only reacts to its own scan.
- Reverted an unconditional `:` stripping in Note file action text that broke explicitly-typed values like `{today:HH:mm}` — only the *default* (no `:FORMAT`) date placeholder is forced to `YYYY-MM-DD` for filenames/folders.
- Note file actions escaping the vault via path traversal (`../outside/name`) — closed.
- Export settings no longer relies on a synthetic download-link click (unreliable on mobile WebViews) — writes directly into the vault instead.
- A rule's `Property` condition now sees property changes made by earlier rules in the same scan, enabling rule chaining within one pass.

## Compatibility
- `minAppVersion`: 1.5.0 (unchanged)
- `isDesktopOnly`: false (unchanged) — no Node.js/Electron APIs used
- No network calls, no telemetry, no account required — all processing stays local to your vault

## Full changelog
See [CHANGELOG.md](https://github.com/diegoeis/obsidian-conditional-properties/blob/main/CHANGELOG.md) for the complete, version-by-version history (0.21.0 through 0.24.0).
