# Conditional Properties (Obsidian Plugin)

Automate frontmatter property updates in your Obsidian notes using simple conditional rules. Define rules like: IF property X equals Y THEN set property Z to W. Run on the whole vault or only on the current file, manually or on a schedule.

What inspired me to do this plugin was:
My Granola meeting notes imports weren’t bringing the same name values as my people notes. So, I created this plugin to correct the names of people in my notes.


## Features

- Define multiple rules with a simple IF/THEN model
- Operators: `equals`, `contains`, `notEquals`
- **Multiple THEN actions per rule**: Set multiple properties in a single rule
- **Scan Scope Options**: Choose between entire vault, latest created notes, or latest modified notes
- **Configurable scan count**: Set number of notes to scan (1-1000, default 15) for latest notes options
- Run on the entire vault (settings button or command)
- Run on the current file (command palette)
- Scheduled scans with a minimum interval of 5 minutes
- Safe updates: only frontmatter properties are modified, body content is preserved
- Handles multi-value properties (arrays/strings): replaces only the matched value

## Installation (Development)

1. Copy this folder into your vault at `.obsidian/plugins/obsidian-conditional-properties`.
2. In Obsidian, go to Settings → Community Plugins → toggle this plugin.

This repository ships the compiled `main.js`. No build step is required for testing.

## Usage

### Run now
- Settings → Conditional Properties → "Run now" button (executes based on selected scan scope).
- Command palette: "Run conditional rules on vault".

### Run on current file
- Command palette: "Run conditional rules on current file".

### Scheduled execution
- Settings → set "Scan interval (minutes)" (minimum 5). The plugin runs automatically using a timer.

## Scan Scope Options

Choose which notes the plugin will scan when running rules:

- **Latest Created notes**: Scan the most recently created notes (configurable count, default 15)
- **Latest Modified notes**: Scan the most recently modified notes (configurable count, default 15)
- **Entire vault**: Scan all notes in the vault

The scan scope can be configured in Settings → Conditional Properties → "Scan Scope".

## Rules

Each rule has:
- `ifProp`: source property name
- `op`: operator (`equals`, `contains`, `notEquals`)
- `ifValue`: value to test
- `thenActions`: array of actions to execute, each with `prop` and `value`

### Examples

1) Rename a person mention in a multi-value property
```yaml
---
related_people: ["[[steve_works]]", "[[John Doe]]"]
---
```
Rule:
```
IF property: related_people, op: equals, value: [[steve_works]]
THEN set property: related_people to [[Steve Jobs]]
```
Result:
```yaml
---
related_people: ["[[Steve Jobs]]", "[[John Doe]]"]
---
```

2) Set a status if a tag contains a keyword
```
IF property: tags, op: contains, value: meeting
THEN set property: status to processed
```

3) Ensure a property differs from a given value
```
IF property: source, op: notEquals, value: transcript-auto
THEN set property: verified to true
```

4) Set multiple properties when a condition is met (NEW!)
```
IF property: tags, op: contains, value: meeting
THEN set properties:
  - status to processed
  - priority to high
  - last_reviewed to [[{{date}}]]
```

5) Update multiple related properties
```
IF property: project_status, op: equals, value: completed
THEN set properties:
  - status to done
  - completed_date to [[{{date}}]]
  - priority to low
  - archived to true
```

## Settings
- Scan interval (minutes): default 5, minimum 5
- **Scan Scope**: Choose between "Latest Created notes", "Latest Modified notes", or "Entire vault"
- **Number of notes**: When using latest notes options, set the number of notes to scan (1-1000, default 15)
- Rules editor: add/remove rules, pick operator, edit values
- Run now button (executes based on selected scope)

## Limitations (V1)
- Only frontmatter is modified
- Operators limited to equality, containment, and inequality
- No folder/tag scoping yet

## Roadmap
- Change names of properties
- Execute changes in the note content, not only properties
- Advanced operators (regex, greater/less than)
- Compound conditions (AND/OR/NOT)
- Multiple actions per rule
- Folder/tag scoping and new-note filters

## Privacy
All processing happens locally in your vault. No data leaves your device.

## License
MIT
