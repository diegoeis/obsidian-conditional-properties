---
layout: default
title: Home
---

# Conditional Properties for Obsidian

**Automate your frontmatter with smart IF/THEN rules.** Set properties, modify titles, and keep your vault organized—automatically.

[View on GitHub](https://github.com/diegoeis/obsidian-conditional-properties) · [Report an issue](https://github.com/diegoeis/obsidian-conditional-properties/issues) · [Changelog](https://github.com/diegoeis/obsidian-conditional-properties/blob/main/CHANGELOG.md)

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
- **Multiple conditions per rule**: combine conditions with `Match any` (OR) or `Match all` (AND) — inspired by Zotero's "match any/all of the following" UI.
- **6 operators**: `exactly`, `contains`, `notContains`, `exists`, `notExists`, `isEmpty`
- **Property-based**: Check any frontmatter property
- **Title-based**: Use note titles (H1 or inline) as conditions
- **Note file-based**: check the file's own name or the folders it lives in — `Filename contains`, `Filename not contains`, `Filename exactly match`, `Parent folder is`, `Parent folder is not`.
- **Regex matching**: wrap any filename/property/title value in `/pattern/` to match with a regular expression instead of a literal string.

### ⚡ Powerful Actions
- **ADD**: Add values without duplicating
- **REMOVE**: Remove specific values
- **OVERWRITE**: Replace entire property
- **DELETE PROPERTY**: Remove property completely
- **CHANGE TITLE**: Add prefix/suffix or overwrite with dynamic dates, filenames, or other property values
- **NOTE FILE actions**: Rename file, Add name prefix, Add name suffix, Move file to (vault-only, auto-creates the destination folder), Delete file — via the official Obsidian API (`fileManager.renameFile` keeps links updated, `fileManager.trashFile` respects your deletion preference)
- **Placeholders in action values**: reference any frontmatter property inline as `{propertyName}` / `{{propertyName}}`, alongside date/time/title placeholders — see [Placeholders](#placeholders) below.
- **Typed property awareness**: when the target property is registered as `checkbox`, `date`, or `datetime`, values are written with the right YAML type instead of as plain strings — so `whatsapp: true` lands as a real boolean (renders as a checked checkbox), and `created_at: 08-08-2025` is parsed and stored as `2025-08-08` (renders in the Obsidian date widget).

### 🎛️ Smart Execution
- **Run on demand**: Entire vault or current file only
- **Stop button**: cancel a running scan; the current file finishes cleanly and remaining files are skipped
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

**Sort transcripts into a dated folder:**
```yaml
IF Note file: Filename contains "transcript"
THEN Note file: Move file to "transcripts/{{date}}"
```
Moves any note whose filename contains `transcript` into a folder like `transcripts/2026-08-22/`, creating it automatically.

## Typed Properties (Checkbox / Date / Datetime)

Some Obsidian property types have native widgets (the checkmark for `checkbox`, the calendar for `date`, the calendar+clock for `datetime`). For the widget to render correctly, the YAML must store the value with the right type — boolean for checkbox, ISO date for date/datetime. Strings won't trigger the widgets, even if the property is registered with the right type.

The plugin detects when the target property is one of these types and converts the rule's value automatically. You can keep writing rules with plain text and the plugin handles the rest.

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
4. If nothing parses (you typed garbage), the input is written as-is and the property won't render in the date widget.

Datetime properties (`YYYY-MM-DDTHH:mm:ss`) are not parsed and are written exactly as typed.

### Typed properties also work on the IF side

The same type-aware coercion happens when matching conditions, not just when writing actions. You can author IF rules using whatever date format you prefer and the plugin will normalize before comparing against the ISO value stored in YAML.

```yaml
IF property: created_at exactly "08-08-2025"
```
matches a note whose YAML stores `created_at: 2025-08-08`. For checkbox properties, `IF property: done exactly "true"` matches a note with `done: true` (boolean) regardless of how the user typed `true` (case-insensitive).

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

Click **+ Add condition** below the IF block to add more conditions, and the dropdown to switch between `any` and `all`.

## Rule Chaining Within a Scan

Rules run in the order they're listed. A `PROPERTY` condition in a later rule sees property changes an earlier rule already made **in the same scan** — not just the frontmatter as it was before the scan started. So this works in a single pass:

```yaml
Rule 1: IF property: status = "done"     THEN ADD tags: completed
Rule 2: IF property: tags contains "completed"   THEN ADD priority: low
```

Rule 2 fires on the same run Rule 1 added the `completed` tag, no second scan needed. Note-file actions in an earlier rule (rename, move) are visible the same way.

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

### Regular expression matching

Wrap the value of `exactly`, `contains`, or `notContains` in forward slashes to match with a regular expression instead of a literal string — same convention as [Obsidian's Web Clipper URL-trigger patterns](https://help.obsidian.md/web-clipper/triggers#Regular+expression+matching). Works on **Property**, **First level heading**, and **Note file** (filename) conditions.

```yaml
IF First level heading contains: /\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])/
```
Matches a title like "Nota da reunião 2026-08-22 com John Doe". Standard JS regex flags are supported as a suffix, e.g. `/report/i` for case-insensitive matching. A malformed pattern never crashes a scan — it's treated as "does not match", with a one-time Notice + console error identifying the broken pattern.

**Mobile note:** avoid regex lookbehind (`(?<=...)` / `(?<!...)`) if you sync your vault to iOS — it isn't supported on iOS versions before 16.4.

### 🧪 Beta: using the regex match in THEN

Reuse whatever your IF regex matched via `{{match}}` and friends, in property values, title actions, and Note file actions:

| Placeholder | Resolves to |
|---|---|
| `{{match}}` | The full text matched by the pattern |
| `{{match:1}}`, `{{match:2}}`, … | Numbered capture group `(...)` |
| `{{match:name}}` | Named capture group, from `(?<name>...)` |

```yaml
IF Note file: Filename contains → /\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])/
THEN Note file: Move file to → transcripts/{{match}}
```
Moves any file whose name contains a date like `2026-08-22` into `transcripts/2026-08-22/`, auto-creating the folder.

## Note File Conditions

Select **Note file** as the condition type to check the file itself, instead of a frontmatter property or the H1 title. All comparisons are case-insensitive.

| Operator | Checks against | Example |
|----------|-----------------|---------|
| `Filename contains` | `file.basename` (no extension) | filename contains "draft" |
| `Filename not contains` | `file.basename` | filename not contains "template" |
| `Filename exactly match` | `file.basename` | filename exactly "index" |
| `Parent folder is` | the folder path the file lives in | see below |
| `Parent folder is not` | the folder path the file lives in (inverted) | see below |

**Parent folder is** accepts either a single folder name or a partial path — enter the folder name(s) only, never a path starting with `/` from the vault root:

```yaml
IF Note file: Parent folder is → "ClienteA"
```
Matches any note under a folder named `ClienteA`, at any depth.

```yaml
IF Note file: Parent folder is → "meetings/transcripts/company"
```
Matches when those three segments appear contiguous and in that order anywhere in the file's folder path.

**Parent folder is not** is the exact inverse — useful to exclude a folder from a broader rule:

```yaml
IF Note file: Parent folder is not → "Archive"
THEN Note file: Add name prefix: "[ACTIVE] "
```

## Note File Actions

Select **Note file** as the THEN action type to change the file itself instead of a frontmatter property or the H1 title.

| Action | Effect |
|--------|--------|
| **Rename file** | Replaces the entire filename (keeps the extension). Left empty → skipped. |
| **Add name prefix** | Prepends text to the current filename. Empty text is a no-op. |
| **Add name suffix** | Appends text to the current filename. Empty text is a no-op. |
| **Move file to** | Moves the file to a folder path inside the vault. **The folder is created automatically if it doesn't exist.** Left empty → skipped. Moving outside the vault isn't possible. |
| **Delete file** | Sends the file to trash using your vault's configured deletion behavior. |

All file actions run through the official Obsidian API: `fileManager.renameFile` for rename/prefix/suffix/move (so links elsewhere in the vault stay intact), and `fileManager.trashFile` for delete.

**Delete stops everything else for that file.** If a "Delete file" action runs, no further actions or rules execute against that file, since it no longer exists.

## Title Actions

Modify note titles dynamically:

- **Prefix**: `[ARCHIVED] Original Title`
- **Suffix**: `Original Title - {date}`
- **Overwrite**: Replace entire title with custom text

## Placeholders

Placeholders work inside **any THEN action value** — property `Add value` / `Overwrite all values with`, title `Prefix` / `Suffix` / `Overwrite`, and Note file `Rename` / `Add name prefix` / `Add name suffix` / `Move file to`.

### Two syntaxes, same placeholders

You can write placeholders with **single braces** (`{date}`, this plugin's original syntax) or **double braces** (`{{date}}`, matching [Obsidian's own Templates syntax](https://obsidian.md/help/plugins/templates)). Both work everywhere, and mix freely. There is exactly **one** deliberate difference:

| | `{date}` (single brace) | `{{date}}` (double brace) |
|---|---|---|
| Meaning | The file's **creation date** | **Today's date** — matches Obsidian's real `{{date}}` |

`{date}` shipped before double-brace support existed and already meant "creation date" for existing users, so it keeps that meaning forever. `{{date}}` matches what `{{date}}` means everywhere else in Obsidian. Every other placeholder name means the same thing in both syntaxes.

| Placeholder | Result |
|---|---|
| `{date}` | File's creation date, default format (`YYYY-MM-DD`). |
| `{{date}}` | **Today's date**, default format (`YYYY-MM-DD`). |
| `{created_date}` / `{{created_date}}` | File's creation date — explicit alias of `{date}`. |
| `{updated_date}` / `{{updated_date}}` | File's last-modified date. |
| `{today}` / `{{today}}` | Today's date, independent of the file. |
| `{time}` / `{{time}}` | Current time, default format (`HH:mm`). |
| `{filename}` / `{{filename}}` | File basename without `.md`. |
| `{title}` / `{{title}}` | Same as `{filename}`. |
| `{propertyName}` / `{{propertyName}}` | Live value of that frontmatter property on the current note. |
| `:FORMAT` suffix | A custom [moment.js](https://momentjs.com/docs/#/displaying/format/) format, e.g. `{date:DD-MM-YYYY}`, `{{date:MM}}`, `{{time:HH:mm:ss}}`. |
| `{{match}}` / `{{match:N}}` / `{{match:name}}` | 🧪 Beta, double-brace only — see [regex match in THEN](#-beta-using-the-regex-match-in-then) above. |

**Going forward, new placeholders ship double-brace only** — no new placeholder gets a single-brace form.

### Property placeholders

Any token that isn't one of the reserved names above and doesn't contain `:` or whitespace is treated as a frontmatter property lookup — in either brace style. So `{g_excerpt}`, `{{g_excerpt}}`, `{summary}` all work.

```yaml
IF property: g_excerpt exists
THEN ADD property excerpt: "{{g_excerpt}}"
```

- **Missing property → empty string.**
- **Arrays are joined with `, `.**
- **Earlier actions in the same rule are visible to later ones.**
- **Reserved names win** — a property named `date`, `today`, etc. won't shadow the reserved placeholder.

### Note file actions: dates are always date-only

Inside `Rename` / `Add name prefix` / `Add name suffix` / `Move file to`, a **bare** date placeholder always resolves to `YYYY-MM-DD`, never a time component, regardless of your vault's configured default date format. An explicit format is always honored exactly as typed.

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
Settings → Scan interval (minutes) → Set interval (minimum 5). The plugin runs automatically based on your selected scope.

### Backup & Restore Settings

Settings → Backup and restore.

- **Export settings** writes `conditional-properties-settings-YYYY-MM-DD.json` to your **vault's root folder** and shows a `Notice` confirming the path. This works the same way on desktop and mobile.
- **Import settings** opens a file picker; pick any exported JSON file to restore your rules and scan settings.

## Privacy

All processing happens locally. No data collection, no external requests.

## License

MIT — see the [full source and license on GitHub](https://github.com/diegoeis/obsidian-conditional-properties).
