# Conditional Properties for Obsidian

**Automate your frontmatter with smart IF/THEN rules.** Set properties, modify titles, and keep your vault organized—automatically.

![Plugin Interface](https://i.imgur.com/d13fhzH.jpeg)

## Why Use This Plugin?

Stop manually updating properties across hundreds of notes. Define rules once, run everywhere. Perfect for:
- 🏷️ Auto-tagging notes based on content
- 📊 Maintaining consistent metadata
- 🔄 Bulk property updates
- ⏰ Scheduled maintenance
- 🎯 Targeted scope (latest created/modified notes)

## Core Features

### 🎯 Flexible Conditions
- **Multiple conditions per rule (new in v0.17.0)**: combine conditions with `Match any` (OR) or `Match all` (AND) — inspired by Zotero's "match any/all of the following" UI.
- **6 operators**: `exactly`, `contains`, `notContains`, `exists`, `notExists`, `isEmpty`
- **Property-based**: Check any frontmatter property
- **Title-based**: Use note titles (H1 or inline) as conditions
- **Note file-based**: check the file's own name or the folders it lives in — `Filename contains`, `Filename not contains`, `Filename exactly match`, `Parent folder is` (v0.22.0), `Parent folder is not` (v0.23.4).

### ⚡ Powerful Actions
- **ADD**: Add values without duplicating
- **REMOVE**: Remove specific values
- **OVERWRITE**: Replace entire property
- **DELETE PROPERTY**: Remove property completely
- **CHANGE TITLE**: Add prefix/suffix or overwrite with dynamic dates, filenames, or other property values
- **NOTE FILE actions (new in v0.23.0)**: Rename file, Add name prefix, Add name suffix, Move file to (vault-only, auto-creates the destination folder), Delete file — via the official Obsidian API (`fileManager.renameFile` keeps links updated, `fileManager.trashFile` respects your deletion preference)
- **Placeholders in action values**: reference any frontmatter property inline as `{propertyName}` (v0.20.0), alongside `{date}`, `{date:FORMAT}`, `{filename}`, and — new in v0.21.0 — `{created_date}` (alias of `{date}`), `{updated_date}` (file's last-modified date), and `{today}` (current date when the rule runs). Works in property values and in title text.
- **Typed property awareness (new in v0.19.0)**: when the target property is registered as `checkbox`, `date`, or `datetime`, values are written with the right YAML type instead of as plain strings — so `whatsapp: true` lands as a real boolean (renders as a checked checkbox), and `created_at: 08-08-2025` is parsed and stored as `2025-08-08` (renders in the Obsidian date widget).

### 🎛️ Smart Execution
- **Run on demand**: Entire vault or current file only
- **Stop button (new in v0.18.0)**: cancel a running scan; the current file finishes cleanly and remaining files are skipped
- **Scheduled scans**: Set intervals (min 5 minutes)
- **Scoped scanning**: Latest created, latest modified, or entire vault
- **Configurable count**: Process 1-1000 notes at once

### 🛡️ Safe & Private
- Only modifies frontmatter (body content preserved)
- All processing happens locally
- No data leaves your device

## Quick Examples

**Auto-tag meetings:**
```yaml
IF property: type = "meeting"
THEN ADD tags: work, important
```

**Archive old projects:**
```yaml
IF property: status = "archived"
THEN REMOVE tags: active, wip
```

**Date-stamp completed tasks:**
```yaml
IF property: status = "done"
THEN Change Title: Add suffix " - {date:DD/MM/YYYY}"
```

**Standardize meeting note titles:**
```yaml
IF title contains: "Meeting"
THEN Change Title: Overwrite to "{date:YYYY-MM-DD} - {filename}"
```
Result: `2026-01-08 - team-sync`

**Clean up deprecated data:**
```yaml
IF property: tags = "old-project"
THEN DELETE PROPERTY: legacy_data
```

**Title-based tagging:**
```yaml
IF title contains: "Meeting"
THEN ADD tags: meeting, important
```

## Typed Properties (Checkbox / Date / Datetime)

Some Obsidian property types have native widgets (the checkmark for `checkbox`, the calendar for `date`, the calendar+clock for `datetime`). For the widget to render correctly, the YAML must store the value with the right type — boolean for checkbox, ISO date for date/datetime. Strings won't trigger the widgets, even if the property is registered with the right type.

Since v0.19.0, the plugin detects when the target property is one of these types and converts the rule's value automatically. You can keep writing rules with plain text and the plugin handles the rest.

### Checkbox

```yaml
IF property: status = "done"
THEN OVERWRITE property: completed = "true"
```
Result on disk: `completed: true` (boolean). Obsidian renders a checked checkbox.

Rules:
- `"true"` (any casing) → `true`
- Anything else (`"false"`, empty, `"sim"`, etc.) → `false`

### Date / Datetime

```yaml
IF property: status = "done"
THEN OVERWRITE property: created_at = "08-08-2025"
```
Result on disk: `created_at: 2025-08-08` (ISO date). Obsidian renders the date widget.

How the date parsing works:
1. If your input is already in `YYYY-MM-DD`, it's stored as-is.
2. Otherwise, the plugin tries to parse it using the Daily Notes core plugin's date format (if enabled), then the Templates core plugin's date format (if enabled), then a few common civilian formats (`DD-MM-YYYY`, `DD/MM/YYYY`, `YYYY/MM/DD`).
3. The first format that parses successfully wins — the value is converted to `YYYY-MM-DD` before being written to the YAML.
4. If nothing parses (you typed garbage), the input is written as-is and the property won't render in the date widget. The plugin doesn't validate format beyond that — garbage in, garbage out.

Datetime properties (`YYYY-MM-DDTHH:mm:ss`) are not parsed and are written exactly as typed. The Obsidian datetime widget will render them when the input is already in the expected ISO datetime form.

### Notes

- This applies to both `ADD value` and `OVERWRITE all values with` actions on typed properties. For these types `ADD` behaves as `OVERWRITE` because the underlying types are scalar (you can't have a checkbox holding `[true, false]`).
- Properties without a registered type (or registered as `text`, `number`, `multitext`, `tags`, etc.) keep the original string-based behavior. Nothing changes for those.

### Typed properties also work on the IF side (since v0.19.1)

The same type-aware coercion now happens when matching conditions, not just when writing actions. You can author IF rules using whatever date format you prefer and the plugin will normalize before comparing against the ISO value stored in YAML.

```yaml
IF property: created_at exactly "08-08-2025"
THEN ...
```
matches a note whose YAML stores `created_at: 2025-08-08`. The same applies to `contains` and `notContains`. For checkbox properties, `IF property: done exactly "true"` matches a note with `done: true` (boolean) regardless of how the user typed `true` (case-insensitive).

## Multiple Conditions Per Rule

Combine conditions inside a single rule using **Match any / Match all of the following** (inspired by Zotero).

**AND example — match all of the following:**
```yaml
Match all of the following:
  - property: status = "done"
  - property: priority = "high"
THEN ADD tags: urgent-completed
```

**OR example — match any of the following:**
```yaml
Match any of the following:
  - property: status = "archived"
  - property: deleted = "true"
THEN REMOVE tags: active
```

Click **+ Add condition** below the IF block to add more conditions, and the dropdown to switch between `any` and `all`. Existing rules from previous plugin versions are auto-migrated and keep their behavior unchanged.

## Rule Chaining Within a Scan

Rules run in the order they're listed. A `PROPERTY` condition in a later rule sees property changes an earlier rule already made **in the same scan** — not just the frontmatter as it was before the scan started. So this works in a single pass:

```yaml
Rule 1: IF property: status = "done"     THEN ADD tags: completed
Rule 2: IF property: tags contains "completed"   THEN ADD priority: low
```

Rule 2 fires on the same run Rule 1 added the `completed` tag, no second scan needed. Note-file actions in an earlier rule (rename, move) are visible the same way — a later rule's `Note file` condition checks the file's *current* name/folder, including any rename/move already applied earlier in the same scan.

## Multiple Actions Per Rule

Combine actions to automate complex workflows:

```yaml
IF property: project_status = "completed"
THEN:
  - SET status [OVERWRITE]: done
  - ADD tags: archived
  - REMOVE tags: active, wip
  - ADD priority: low
```

## Scan Scopes

Choose what to scan:
- **Latest Created**: Process newest notes (default: 15)
- **Latest Modified**: Process recently edited notes (default: 15)
- **Entire Vault**: Process all notes

Perfect for running rules only on active notes instead of your entire vault.

## Operators Reference

| Operator | Description | Example |
|----------|-------------|---------|
| `exactly` | Exact match | `type = "meeting"` |
| `contains` | Substring match | `name contains "Diego"` |
| `notContains` | Does not contain | `tags notContains "draft"` |
| `exists` | Property present | `status exists` |
| `notExists` | Property absent | `reviewed notExists` |
| `isEmpty` | Empty value | `tags isEmpty` |

### Regular expression matching (new in v0.24.0)

Wrap the value of `exactly`, `contains`, or `notContains` in forward slashes to match with a regular expression instead of a literal string — same convention as [Obsidian's Web Clipper URL-trigger patterns](https://help.obsidian.md/web-clipper/triggers#Regular+expression+matching). Works on **Property**, **First level heading**, and **Note file** (filename) conditions.

```yaml
IF First level heading contains: /\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])/
```
Matches a title like "Nota da reunião 2026-08-22 com John Doe" — the plugin finds the date `2026-08-22` inside the text. Standard JS regex flags are supported as a suffix, e.g. `/report/i` for case-insensitive matching or `/^draft/m` for multiline. If the text you type looks like a regex but is missing its `/slashes/`, the settings UI shows a hint under the field so it's easy to catch. A malformed pattern (or unknown flag) never crashes a scan: it's treated as "does not match" and you'll get a one-time Notice + console error identifying the broken pattern.

### 🧪 Beta: using the regex match in THEN

Reuse whatever your IF regex matched — no need to retype it in the THEN action. Available in **property values**, **title actions**, and **Note file actions** (rename / prefix / suffix / move), via `{{match}}` and friends:

| Placeholder | Resolves to |
|---|---|
| `{{match}}` | The full text matched by the pattern |
| `{{match:1}}`, `{{match:2}}`, … | Numbered capture group `(...)` — non-capturing groups `(?:...)` don't count |
| `{{match:name}}` | Named capture group, from a pattern written as `(?<name>...)` |

```yaml
IF Note file: Filename contains → /\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])/
THEN Note file: Move file to → transcripts/{{match}}
```
Moves any file whose name contains a date like `2026-08-22` into `transcripts/2026-08-22/`, auto-creating the folder — no need to duplicate the date pattern on the THEN side.

Named groups work the same way:
```yaml
IF Note file: Filename contains → /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/
THEN Note file: Move file to → transcripts/{{match:year}}/{{match:month}}
```

**Current limitations (beta):**
- `{{match}}` reads from the **first** regex-mode condition (in the order you listed them) that was the reason the rule matched. A rule with multiple conditions doesn't expose more than one condition's captures.
- Not supported yet for a `Property` condition whose value is a **list** (e.g. `tags`) — regex still matches against list items, but there's no single scalar to pull a capture from. `Property` (single value), `First level heading`, and `Note file` (filename) conditions are supported.
- Double-brace only (`{{match}}`), matching the rule that all placeholders introduced from now on ship `{{}}`-only, with no legacy `{}` form — see the placeholder syntax note below.
- If the rule had no matching regex condition, or you reference a group/name that doesn't exist in the pattern, `{{match...}}` resolves to an empty string rather than erroring.

## Note File Conditions (new in v0.22.0)

Select **Note file** as the condition type to check the file itself, instead of a frontmatter property or the H1 title. All comparisons are case-insensitive.

| Operator | Checks against | Example |
|----------|-----------------|---------|
| `Filename contains` | `file.basename` (no extension) | filename contains "draft" |
| `Filename not contains` | `file.basename` | filename not contains "template" |
| `Filename exactly match` | `file.basename` | filename exactly "index" |
| `Parent folder is` | the folder path the file lives in | see below |
| `Parent folder is not` | the folder path the file lives in (inverted) | see below |

The three filename operators above also accept a `/regex/`-wrapped value (see [Regular expression matching](#regular-expression-matching-new-in-v0240)); `Parent folder is` / `Parent folder is not` always stay literal path matching.

**Parent folder is** accepts either a single folder name or a partial path — enter the folder name(s) only, never a path starting with `/` from the vault root:

```yaml
IF Note file: Parent folder is → "ClienteA"
```
Matches any note under a folder named `ClienteA`, at any depth — `ClienteA/notes/file.md` and `Projects/ClienteA/2026/file.md` both match.

```yaml
IF Note file: Parent folder is → "meetings/transcripts/company"
```
Matches when those three segments appear contiguous and in that order anywhere in the file's folder path — e.g. `Work/meetings/transcripts/company/2026/file.md` matches, but `meetings/company/transcripts/file.md` does not (wrong order).

**Parent folder is not** is the exact inverse — same matching rules, opposite result. Useful to exclude a folder from a broader rule:

```yaml
IF Note file: Parent folder is not → "Archive"
THEN Note file: Add name prefix: "[ACTIVE] "
```
Runs on every note **except** those under an `Archive` folder anywhere in their path. Leaving the value empty makes `Parent folder is` never match and `Parent folder is not` always match (same "nothing to compare against" convention as the `does not contain` operator elsewhere in the plugin).

## Note File Actions (new in v0.23.0)

Select **Note file** as the THEN action type to change the file itself instead of a frontmatter property or the H1 title. All text fields support the same placeholders as property/title actions (`{date}`, `{created_date}`, `{updated_date}`, `{today}`, `{filename}`, `{propertyName}`).

**A bare date placeholder here is always date-only.** `{today}` (or `{date}` / `{created_date}` / `{updated_date}`) with no explicit `:FORMAT` always resolves to `YYYY-MM-DD` in these fields — never a time component, even if your vault has a different default date format configured elsewhere. This only applies to the no-format default: if you explicitly type a format, e.g. `{today:YYYY-MM-DD_HH-mm}`, it's honored exactly as you typed it — including a literal `:` if your OS's filesystem accepts one. The plugin never second-guesses text you typed explicitly, only the automatic default.

| Action | Effect |
|--------|--------|
| **Rename file** | Replaces the entire filename (keeps the extension) with the text you enter. Left empty → skipped, the rest of the rule's actions still run. |
| **Add name prefix** | Prepends text to the current filename. Empty text is a no-op. |
| **Add name suffix** | Appends text to the current filename. Empty text is a no-op. |
| **Move file to** | Moves the file to a folder path inside the vault (e.g. `Archive/2026`). **The folder is created automatically if it doesn't exist** — you never need to pre-create the destination. Left empty → skipped. Moving outside the vault isn't possible — Obsidian's plugin API has no access beyond the vault sandbox. |
| **Delete file** | Sends the file to trash using your vault's configured deletion behavior (system trash, `.trash` folder, or permanent — whatever you set in Obsidian's Files & Links settings). |

All file actions run through the official Obsidian API: `fileManager.renameFile` for rename/prefix/suffix/move (so links elsewhere in the vault stay intact), and `fileManager.trashFile` for delete.

### Move file to: auto-creates the destination folder

Because the folder is created if missing, **`Move file to` works great combined with date placeholders** to sort files into folders that don't exist yet — you set the rule up once, and it creates a fresh folder every day/month/year as needed.

```yaml
IF Note file: Filename contains "transcript"
THEN Note file: Move file to "transcripts/{today}"
```
Today (2026-08-22), this moves any note whose filename contains `transcript` into `transcripts/2026-08-22/` — creating both `transcripts/` and `transcripts/2026-08-22/` the first time it runs, and reusing them on later runs the same day. Use `{today:YYYY-MM}` instead of `{today}` if you want one folder per month rather than per day.

**Multiple file actions in the same rule compose in sequence** — each one executes immediately, so a later action sees the result of an earlier one:

```yaml
THEN:
  - Note file → Add name prefix: "[ARCHIVED] "
  - Note file → Move file to: "Archive/{today:YYYY}"
```
The file is prefixed first, then the already-renamed file is moved.

**Delete stops everything else for that file.** If a "Delete file" action runs — in this rule or an earlier one in the same scan — no further actions or rules execute against that file, since it no longer exists.

## Title Actions

Modify note titles dynamically:

- **Prefix**: `[ARCHIVED] Original Title`
- **Suffix**: `Original Title - {date}`
- **Overwrite**: Replace entire title with custom text

## Placeholders

Placeholders work inside **any THEN action value** — property `Add value` / `Overwrite all values with`, title `Prefix` / `Suffix` / `Overwrite`, and Note file `Rename` / `Add name prefix` / `Add name suffix` / `Move file to`. They're expanded at the moment the rule runs, against the file being processed.

### Two syntaxes, same placeholders (new in v0.24.0)

You can write placeholders with **single braces** (`{date}`, this plugin's original syntax) or **double braces** (`{{date}}`, matching [Obsidian's own Templates syntax](https://obsidian.md/help/plugins/templates)). Both work everywhere, and you can mix them freely in the same value. There is exactly **one** deliberate difference between the two:

| | `{date}` (single brace) | `{{date}}` (double brace) |
|---|---|---|
| Meaning | The file's **creation date** | **Today's date** — matches Obsidian's real `{{date}}` |

This is not a bug — `{date}` shipped before double-brace support existed and already meant "creation date" for existing users, so it keeps that meaning forever for backward compatibility. `{{date}}` was added later specifically to match what `{{date}}` means in every other part of Obsidian (today), so plugin users who already know Obsidian's template syntax get what they expect. Every other placeholder name means the exact same thing in both syntaxes — this divergence is unique to `date`.

| Placeholder | Result |
|---|---|
| `{date}` | File's creation date, default format (`YYYY-MM-DD`). Example: `2026-01-08`. |
| `{{date}}` | **Today's date** (not the file's), default format (`YYYY-MM-DD`) — matches Obsidian's Templates `{{date}}`. |
| `{created_date}` / `{{created_date}}` | File's creation date — explicit alias of `{date}`, same meaning in both syntaxes (v0.21.0). |
| `{updated_date}` / `{{updated_date}}` | File's last-modified date (v0.21.0). |
| `{today}` / `{{today}}` | Today's date, independent of the file (v0.21.0) — same value as `{{date}}`. |
| `{time}` / `{{time}}` | Current time, default format (`HH:mm`) — matches Obsidian's Templates `{{time}}` (new in v0.24.0). |
| `{filename}` / `{{filename}}` | File basename without `.md`. Example: `meeting-notes`. |
| `{title}` / `{{title}}` | Same as `{filename}` — matches Obsidian's Templates `{{title}}` (new in v0.24.0). |
| `{propertyName}` / `{{propertyName}}` | Live value of that frontmatter property on the current note (v0.20.0). |
| `:FORMAT` suffix | Any of the above with a custom [moment.js](https://momentjs.com/docs/#/displaying/format/) format — works with either brace style: `{date:DD-MM-YYYY}` → `08-01-2026`, `{{date:MM}}` → just today's month, `{{time:HH:mm:ss}}`, `{updated_date:YYYY}`. |
| `{{match}}` / `{{match:N}}` / `{{match:name}}` | 🧪 Beta, **double-brace only** — see [Using the regex match in THEN](#-beta-using-the-regex-match-in-then) above. |

**Going forward, new placeholders ship double-brace only.** The single/double-brace pair above is frozen as-is for backward compatibility — no new placeholder gets a single-brace form, `{{match}}` being the first one.

### Property placeholders (v0.20.0)

Any token that isn't one of the reserved names above and doesn't contain `:` or whitespace is treated as a frontmatter property lookup — in either brace style. So `{g_excerpt}`, `{{g_excerpt}}`, `{summary}`, `{kebab-case-prop}` all work.

**Copy a value from one property to another:**
```yaml
IF property: g_excerpt exists
THEN ADD property excerpt: "{{g_excerpt}}"
```

Behavior:
- **Missing property → empty string.** No errors, no literal `{name}` or `{{name}}` left behind in your YAML.
- **Arrays are joined with `, `.** A source like `tags: [a, b, c]` becomes `a, b, c` in the expanded string.
- **Earlier actions in the same rule are visible to later ones.** The expansion reads from the in-progress frontmatter, so if action #1 sets `excerpt`, action #2 can reference `{excerpt}` or `{{excerpt}}`.
- **Reserved names win.** `date`, `created_date`, `updated_date`, `today`, `time`, `title`, and `filename` are resolved as reserved placeholders first (in both brace styles); a property with one of those names won't shadow them.

### Note file actions: dates are always date-only

Inside `Rename` / `Add name prefix` / `Add name suffix` / `Move file to`, a **bare** date placeholder (`{{date}}`, `{date}`, `{created_date}`, `{updated_date}`, `{today}` — no explicit `:FORMAT`) always resolves to `YYYY-MM-DD`, never a time component, regardless of your vault's configured default date format. File and folder names elsewhere in the OS can't contain certain characters depending on platform, so these fields don't inherit a format that might not have been meant for filenames. An explicit format is always honored exactly as typed, including one with `:` in it — the plugin never rewrites what you explicitly typed, it only picks a safe default when you didn't specify one.

### Combinations

Placeholders mix freely in the same value, and the two brace styles combine freely too:
- `{{date:YYYY-MM-DD}} - {{title}}` → `2026-08-22 - meeting-notes`
- `Meeting {filename} - {date:DD/MM/YY}` → `Meeting meeting-notes - 08/01/26`
- `{{date}}/{{title}}` as a Move file to destination → `2026-08-22/meeting-notes` (folder auto-created)
- `{g_title} ({date:YYYY})` → `My Post (2026)`

## Installation

### From Community Plugins
1. Settings → Community Plugins → Browse
2. Search "Conditional Properties"
3. Install and enable

### Manual Installation
1. Copy folder to `.obsidian/plugins/obsidian-conditional-properties`
2. Settings → Community Plugins → Enable "Conditional Properties"

## Usage

### Run Manually
- **Settings**: Conditional Properties → "Run now" button
- **Command Palette**: "Run conditional rules on vault"
- **Current file**: "Run conditional rules on current file"

### Schedule Execution
Settings → Scan interval (minutes) → Set interval (minimum 5)

The plugin runs automatically based on your selected scope.

### Backup & Restore Settings

Settings → Backup and restore.

- **Export settings** writes `conditional-properties-settings-YYYY-MM-DD.json` to your **vault's root folder** (not your OS's Downloads folder) and shows a `Notice` confirming the path. This works the same way on desktop and mobile — earlier versions triggered a browser download dialog, which isn't reliable in Obsidian Mobile's WebView.
- **Import settings** opens a file picker; pick any exported JSON file to restore your rules and scan settings.

## Roadmap

- [x] IF/THEN rules engine
- [x] 6 property operators
- [x] Multiple actions per rule
- [x] Title modifications with date placeholders
- [x] Scheduled scans
- [x] Scoped execution (latest/entire vault)
- [x] Current file execution
- [x] Property existence checks
- [x] Rename property action
- [x] Title overwrite with `{filename}` and `{date:FORMAT}` placeholders
- [x] Multiple conditions per rule (`match any` / `match all`)
- [x] Frontmatter property placeholders (`{propertyName}`) in action values
- [ ] Modify note content (beyond frontmatter)
- [x] Regex matching (`/pattern/`) on `exactly` / `contains` / `notContains`
- [ ] Comparison operators (greater than / less than)
- [ ] Nested condition groups (e.g. `(A AND B) OR C`)
- [ ] Folder/tag-based scoping

## Privacy

All processing happens locally. No data collection, no external requests.

## License

MIT
