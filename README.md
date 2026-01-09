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
- **6 operators**: `exactly`, `contains`, `notContains`, `exists`, `notExists`, `isEmpty`
- **Property-based**: Check any frontmatter property
- **Title-based**: Use note titles (H1 or inline) as conditions

### ⚡ Powerful Actions
- **ADD**: Add values without duplicating
- **REMOVE**: Remove specific values
- **OVERWRITE**: Replace entire property
- **DELETE PROPERTY**: Remove property completely
- **CHANGE TITLE**: Add prefix/suffix or overwrite with dynamic dates and filenames

### 🎛️ Smart Execution
- **Run on demand**: Entire vault or current file only
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

### From Community Plugins (Coming Soon)
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
- [ ] Rename property action
- [ ] Modify note content (beyond frontmatter)
- [ ] Advanced operators (regex, comparison)
- [ ] Compound conditions (AND/OR/NOT)
- [ ] Folder/tag-based scoping

## Privacy

All processing happens locally. No data collection, no external requests.

## License

MIT
