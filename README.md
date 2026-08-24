# Conditional Properties for Obsidian

**Automate your frontmatter with smart IF/THEN rules.** Set properties, modify titles, and keep your vault organized — automatically.

📖 [Full documentation site](https://diegoeis.github.io/obsidian-conditional-properties/)

![Plugin Interface](https://i.imgur.com/d13fhzH.jpeg)

## Why use this plugin?

Stop manually updating properties across hundreds of notes. Define rules once, run everywhere. Useful for:
- Auto-tagging notes based on content
- Maintaining consistent metadata
- Bulk property updates
- Scheduled maintenance
- Targeted scope (latest created/modified notes, or a single file)

## Features

Every feature below has a short description and a working example. Deeper reference detail (full operator tables, placeholder syntax, typed-property parsing rules) lives further down — this section is the map.

### Conditions (IF)

**Property condition** — check any frontmatter property's value.
```yaml
IF property: status exactly "done"
```

**First level title condition** — check the note's title (the H1 immediately after frontmatter, or the inline title).
```yaml
IF First level title contains "Meeting"
```

**Note file condition** — check the file itself: its name or the folder(s) it lives in, instead of a property or title.
```yaml
IF Note file: Filename contains "draft"
```

**Parent folder is / Parent folder is not** — match a folder name or partial path anywhere in the file's location, not just the immediate parent.
```yaml
IF Note file: Parent folder is "meetings/transcripts/company"
```

**Six comparison operators** — `exactly`, `contains`, `notContains`, `exists`, `notExists`, `isEmpty`. See the full [Operators reference](#operators-reference) below.
```yaml
IF property: tags notContains "draft"
```

**Regex matching** — wrap a value in `/pattern/flags` to match with a regular expression instead of a literal string, on `exactly`/`contains`/`notContains`. See [Regular expression matching](#regular-expression-matching).
```yaml
IF First level title contains /\d{4}-\d{2}-\d{2}/
```

**Multiple conditions per rule** — combine conditions with `Match any` (OR) or `Match all` (AND).
```yaml
Match all of the following:
  - property: status exactly "done"
  - property: priority exactly "high"
THEN ADD tags: urgent-completed
```

**Typed property awareness (IF side)** — when a property is registered as `checkbox`, `date`, or `datetime`, your typed value is normalized before comparing, so `08-08-2025` matches a stored `2025-08-08`.
```yaml
IF property: created_at exactly "08-08-2025"
```
matches a note whose YAML stores `created_at: 2025-08-08`.

**Rule chaining within a scan** — a later rule's condition sees property (or filename/folder) changes an earlier rule already made in the same run, not just the state from before the scan started.
```yaml
Rule 1: IF property: status exactly "done"            THEN ADD tags: completed
Rule 2: IF property: tags contains "completed"  THEN ADD priority: low
```
Rule 2 fires in the same pass Rule 1 added the tag — no second scan needed.

### Actions (THEN)

**Add value** — add a value to a property without duplicating it. Converts a scalar to an array when needed.
```yaml
THEN ADD tags: important
```

**Remove value** — remove a specific value from a property or array.
```yaml
THEN REMOVE tags: active, wip
```

**Overwrite property** — replace the entire value.
```yaml
THEN OVERWRITE property: status = "archived"
```

**Delete property** — remove the property from the note entirely.
```yaml
THEN DELETE PROPERTY: legacy_data
```

**Rename property** — copy a property's value to a new name and remove the old one.
```yaml
THEN RENAME property: old_name -> new_name
```

**Typed property awareness (THEN side)** — writing to a `checkbox`/`date`/`datetime` property stores the real YAML type, so Obsidian's native widgets render correctly.
```yaml
THEN OVERWRITE property: completed = "true"
```
Result on disk: `completed: true` (boolean) — renders as a checked checkbox, not text.

**First level title actions** — prefix, suffix, or overwrite the note's title.
```yaml
THEN First level title: Overwrite to "{date:YYYY-MM-DD} - {filename}"
```
Result: `2026-01-08 - team-sync`.

**Note file actions** — Rename file, Add name prefix, Add name suffix, Move file to, Delete file. See [Note file actions](#note-file-actions).
```yaml
THEN Note file: Move file to "Archive/{today:YYYY}"
```

**Multiple actions per rule** — chain several actions in one rule; note file actions execute immediately and compose in sequence.
```yaml
THEN:
  - OVERWRITE property: status = "done"
  - ADD tags: archived
  - REMOVE tags: active, wip
```

**Placeholders in action values** — reference dates, the filename, or any frontmatter property inline. See the full [Placeholders](#placeholders) reference.
```yaml
THEN ADD property excerpt: "{{g_excerpt}}"
```

**{{match}} in THEN (Beta)** — reuse whatever an IF regex condition matched, instead of retyping the pattern. See [{{match}} in THEN](#match-in-then-beta).
```yaml
IF Note file: Filename contains /\d{4}-\d{2}-\d{2}/
THEN Note file: Move file to "transcripts/{{match}}"
```

### Execution & scheduling

**Run manually** — the whole vault, or just the current file.
- Settings → Conditional Properties → "Run now"
- Command palette → "Run conditional rules on vault" / "Run conditional rules on current file"

**Run this rule** — run a single rule against its current scan scope, without running every other rule.

**Stop button** — cancel a running scan; the file currently being processed finishes cleanly and the rest are skipped.

**Scheduled scans** — run automatically on an interval (minimum 5 minutes).

**Scan scopes** — Latest created, Latest modified, or Entire vault, with a configurable note count (1-1000) for the two "latest" scopes.
```yaml
Scope: Latest modified, count: 15
```

### Settings management

**Backup and restore settings** — export your rules and scan settings to a JSON file in the vault, and re-import them later or on another vault.
- Settings → Conditional Properties → Backup and restore → Export settings / Import settings

## Operators reference

| Operator | Description | Example |
|----------|-------------|---------|
| `exactly` | Exact match | `type exactly "meeting"` |
| `contains` | Substring match | `name contains "Diego"` |
| `notContains` | Does not contain | `tags notContains "draft"` |
| `exists` | Property present | `status exists` |
| `notExists` | Property absent | `reviewed notExists` |
| `isEmpty` | Empty value | `tags isEmpty` |

### Regular expression matching

Wrap the value of `exactly`, `contains`, or `notContains` in forward slashes to match with a regular expression instead of a literal string — same convention as [Obsidian's Web Clipper URL-trigger patterns](https://help.obsidian.md/web-clipper/triggers#Regular+expression+matching). Works on **Property**, **First level title**, and **Note file** (filename) conditions.

```yaml
IF First level title contains: /\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])/
```
Matches a title like "Nota da reunião 2026-08-22 com John Doe" — the plugin finds the date `2026-08-22` inside the text. Standard JS regex flags are supported as a suffix, e.g. `/report/i` for case-insensitive matching or `/^draft/m` for multiline. If the text you type looks like a regex but is missing its `/slashes/`, the settings UI shows a hint under the field so it's easy to catch. A malformed pattern (or unknown flag) never crashes a scan: it's treated as "does not match" and you'll get a one-time Notice + console error identifying the broken pattern.

**Mobile note:** avoid regex lookbehind (`(?<=...)` / `(?<!...)`) if you sync your vault to iOS — it isn't supported on iOS versions before 16.4. Named capture groups (`(?<name>...)`, used by [`{{match:name}}`](#match-in-then-beta) below) are unaffected; only *lookbehind* assertions are the risk.

### {{match}} in THEN (Beta)

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
- Not supported yet for a `Property` condition whose value is a **list** (e.g. `tags`) — regex still matches against list items, but there's no single scalar to pull a capture from. `Property` (single value), `First level title`, and `Note file` (filename) conditions are supported.
- Double-brace only (`{{match}}`) — see [Two syntaxes, same placeholders](#two-syntaxes-same-placeholders).
- If the rule had no matching regex condition, or you reference a group/name that doesn't exist in the pattern, `{{match...}}` resolves to an empty string rather than erroring.

## Multiple conditions per rule

Combine conditions inside a single rule using **Match any / Match all of the following** (inspired by Zotero).

**AND example — match all of the following:**
```yaml
Match all of the following:
  - property: status exactly "done"
  - property: priority exactly "high"
THEN ADD tags: urgent-completed
```

**OR example — match any of the following:**
```yaml
Match any of the following:
  - property: status exactly "archived"
  - property: deleted exactly "true"
THEN REMOVE tags: active
```

Click **+ Add condition** below the IF block to add more conditions, and the dropdown to switch between `any` and `all`. Existing rules from previous plugin versions are auto-migrated and keep their behavior unchanged.

## Note file conditions

Select **Note file** as the condition type to check the file itself, instead of a frontmatter property or the H1 title. All comparisons are case-insensitive.

| Operator | Checks against | Example |
|----------|-----------------|---------|
| `Filename contains` | `file.basename` (no extension) | filename contains "draft" |
| `Filename not contains` | `file.basename` | filename not contains "template" |
| `Filename exactly match` | `file.basename` | filename exactly "index" |
| `Parent folder is` | the folder path the file lives in | see below |
| `Parent folder is not` | the folder path the file lives in (inverted) | see below |

The three filename operators above also accept a `/regex/`-wrapped value (see [Regular expression matching](#regular-expression-matching)); `Parent folder is` / `Parent folder is not` always stay literal path matching.

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

## Note file actions

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
This moves any note whose filename contains `transcript` into `transcripts/YYYY-MM-DD/` (today's date) — creating both `transcripts/` and the dated subfolder the first time it runs, and reusing them on later runs the same day. Use `{today:YYYY-MM}` instead of `{today}` if you want one folder per month rather than per day.

**Multiple file actions in the same rule compose in sequence** — each one executes immediately, so a later action sees the result of an earlier one:

```yaml
THEN:
  - Note file → Add name prefix: "[ARCHIVED] "
  - Note file → Move file to: "Archive/{today:YYYY}"
```
The file is prefixed first, then the already-renamed file is moved.

**Delete stops everything else for that file.** If a "Delete file" action runs — in this rule or an earlier one in the same scan — no further actions or rules execute against that file, since it no longer exists.

## Typed properties (checkbox / date / datetime)

Some Obsidian property types have native widgets (the checkmark for `checkbox`, the calendar for `date`, the calendar+clock for `datetime`). For the widget to render correctly, the YAML must store the value with the right type — boolean for checkbox, ISO date for date/datetime. Strings won't trigger the widgets, even if the property is registered with the right type.

The plugin detects when the target property is one of these types and converts the rule's value automatically, on both the IF and THEN sides. You can keep writing rules with plain text and the plugin handles the rest.

### Checkbox

```yaml
IF property: status exactly "done"
THEN OVERWRITE property: completed = "true"
```
Result on disk: `completed: true` (boolean). Obsidian renders a checked checkbox.

Rules:
- `"true"` (any casing) → `true`
- Anything else (`"false"`, empty, `"sim"`, etc.) → `false`

### Date / datetime

```yaml
IF property: status exactly "done"
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
- The same type-aware coercion happens when matching IF conditions, not just when writing THEN actions. For checkbox properties, `IF property: done exactly "true"` matches a note with `done: true` (boolean) regardless of how the user typed `true` (case-insensitive).

## Rule chaining within a scan

Rules run in the order they're listed. A `PROPERTY` condition in a later rule sees property changes an earlier rule already made **in the same scan** — not just the frontmatter as it was before the scan started. So this works in a single pass:

```yaml
Rule 1: IF property: status exactly "done"     THEN ADD tags: completed
Rule 2: IF property: tags contains "completed"   THEN ADD priority: low
```

Rule 2 fires on the same run Rule 1 added the `completed` tag, no second scan needed. Note file actions in an earlier rule (rename, move) are visible the same way — a later rule's `Note file` condition checks the file's *current* name/folder, including any rename/move already applied earlier in the same scan.

## Scan scopes

Choose what to scan:
- **Latest created**: process newest notes (default: 15)
- **Latest modified**: process recently edited notes (default: 15)
- **Entire vault**: process all notes

Useful for running rules only on active notes instead of your entire vault.

## Placeholders

Placeholders work inside **any THEN action value** — property `Add value` / `Overwrite all values with`, title `Prefix` / `Suffix` / `Overwrite`, and Note file `Rename` / `Add name prefix` / `Add name suffix` / `Move file to`. They're expanded at the moment the rule runs, against the file being processed.

### Two syntaxes, same placeholders

You can write placeholders with **single braces** (`{date}`, this plugin's original syntax) or **double braces** (`{{date}}`, matching [Obsidian's own Templates syntax](https://obsidian.md/help/plugins/templates)). Both work everywhere, and you can mix them freely in the same value. There is exactly **one** deliberate difference between the two:

| | `{date}` (single brace) | `{{date}}` (double brace) |
|---|---|---|
| Meaning | The file's **creation date** | **Today's date** — matches Obsidian's real `{{date}}` |

This is not a bug — `{date}` shipped before double-brace support existed and already meant "creation date" for existing users, so it keeps that meaning forever for backward compatibility. `{{date}}` was added later specifically to match what `{{date}}` means in every other part of Obsidian (today), so plugin users who already know Obsidian's template syntax get what they expect. Every other placeholder name means the exact same thing in both syntaxes — this divergence is unique to `date`.

| Placeholder | Result |
|---|---|
| `{date}` | File's creation date, default format (`YYYY-MM-DD`). Example: `2026-01-08`. |
| `{{date}}` | **Today's date** (not the file's), default format (`YYYY-MM-DD`) — matches Obsidian's Templates `{{date}}`. |
| `{created_date}` / `{{created_date}}` | File's creation date — explicit alias of `{date}`, same meaning in both syntaxes. |
| `{updated_date}` / `{{updated_date}}` | File's last-modified date. |
| `{today}` / `{{today}}` | Today's date, independent of the file — same value as `{{date}}`. |
| `{time}` / `{{time}}` | Current time, default format (`HH:mm`) — matches Obsidian's Templates `{{time}}`. |
| `{filename}` / `{{filename}}` | File basename without `.md`. Example: `meeting-notes`. |
| `{title}` / `{{title}}` | Same as `{filename}` — matches Obsidian's Templates `{{title}}`. |
| `{propertyName}` / `{{propertyName}}` | Live value of that frontmatter property on the current note. |
| `:FORMAT` suffix | Any of the above with a custom [moment.js](https://momentjs.com/docs/#/displaying/format/) format — works with either brace style: `{date:DD-MM-YYYY}` → `08-01-2026`, `{{date:MM}}` → just today's month, `{{time:HH:mm:ss}}`, `{updated_date:YYYY}`. |
| `{{match}}` / `{{match:N}}` / `{{match:name}}` | Beta, **double-brace only** — see [{{match}} in THEN](#match-in-then-beta) above. |

**Going forward, new placeholders ship double-brace only.** The single/double-brace pair above is frozen as-is for backward compatibility — no new placeholder gets a single-brace form, `{{match}}` being the first one.

### Property placeholders

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

### Manual installation
1. Copy folder to `.obsidian/plugins/obsidian-conditional-properties`
2. Settings → Community Plugins → Enable "Conditional Properties"

## Usage

### Run manually
- **Settings**: Conditional Properties → "Run now" button
- **Command Palette**: "Run conditional rules on vault"
- **Current file**: "Run conditional rules on current file"

### Schedule execution
Settings → Scan interval (minutes) → Set interval (minimum 5)

The plugin runs automatically based on your selected scope.

### Backup and restore settings

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
- [x] Regex matching (`/pattern/`) on `exactly` / `contains` / `notContains`
- [ ] Modify note content (beyond frontmatter)
- [ ] Comparison operators (greater than / less than)
- [ ] Nested condition groups (e.g. `(A AND B) OR C`)
- [ ] Folder/tag-based scoping

## Privacy

All processing happens locally. No data collection, no external requests.

## License

MIT
