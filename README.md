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

### ⚡ Powerful Actions
- **ADD**: Add values without duplicating
- **REMOVE**: Remove specific values
- **OVERWRITE**: Replace entire property
- **DELETE PROPERTY**: Remove property completely
- **CHANGE TITLE**: Add prefix/suffix or overwrite with dynamic dates and filenames
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

## Title Actions

Modify note titles dynamically:

- **Prefix**: `[ARCHIVED] Original Title`
- **Suffix**: `Original Title - {date}`
- **Overwrite**: Replace entire title with custom text

### Available Placeholders

- **{date}**: File creation date (default format)
  - Example: `{date}` → `2026-01-08`
- **{date:FORMAT}**: Custom date format (moment.js)
  - Example: `{date:DD-MM-YYYY}` → `08-01-2026`
  - Example: `{date:YYYY/MM/DD}` → `2026/01/08`
- **{filename}**: Current file basename (without .md)
  - Example: For file `meeting-notes.md` → `meeting-notes`

### Placeholder Combinations

Placeholders can be combined in any order:
- `{date:YYYY-MM-DD} - {filename}` → `2026-01-08 - meeting-notes`
- `Meeting {filename} - {date:DD/MM/YY}` → `Meeting meeting-notes - 08/01/26`
- `{filename}` → `meeting-notes` (overwrite with just filename)

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
- [ ] Modify note content (beyond frontmatter)
- [ ] Advanced operators (regex, comparison)
- [ ] Nested condition groups (e.g. `(A AND B) OR C`)
- [ ] Folder/tag-based scoping

## Privacy

All processing happens locally. No data collection, no external requests.

## License

MIT
