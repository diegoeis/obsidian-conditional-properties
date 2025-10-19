# Conditional Properties (Obsidian Plugin)

Automate frontmatter property updates in your Obsidian notes using simple conditional rules. Define rules like: IF property X equals Y THEN set property Z to W. Run on the whole vault or only on the current file, manually or on a schedule.

What inspired me to do this plugin was:
My Granola meeting notes imports weren’t bringing the same name values as my people notes. So, I created this plugin to correct the names of people in my notes.

![https://i.imgur.com/xfz21us.png](https://i.imgur.com/xfz21us.png)


## Features

- Define multiple rules with a simple IF/THEN model
- Operators: `contains`, `notContains`
- **Multiple THEN actions per rule**: Set multiple properties in a single rule
- **Comma-separated values**: Set multiple values for a property (e.g., "work, apple" → properly formatted YAML array)
- **ADD/REMOVE actions**: Choose to ADD values to a property or REMOVE specific values
- **Smart property merging**: Add values to existing properties without duplicating
- **Scan Scope Options**: Choose between entire vault, latest created notes, or latest modified notes
- **Configurable scan count**: Set number of notes to scan (1-1000, default 15) for latest notes options
- **Title-based conditions**: Use the note's title (first H1 after YAML frontmatter or inline title) as the IF condition
- Run on the entire vault (settings button or command)
- Run on the current file (command palette)
- Scheduled scans with a minimum interval of 5 minutes
- Safe updates: only frontmatter properties are modified, body content is preserved
- Handles multi-value properties (arrays/strings): preserves existing values when adding

## Settings
- Scan interval (minutes): default 5, minimum 5
- **Scan Scope**: Choose between "Latest Created notes", "Latest Modified notes", or "Entire vault"
- **Number of notes**: When using latest notes options, set the number of notes to scan (1-1000, default 15)
- Rules editor: add/remove rules, pick operator, edit values
- Run now button (executes based on selected scope)
- Add many values in the same THEN action separated by commas
- Add multiple THEN actions


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

## ADD/REMOVE Actions

When setting properties in THEN actions, you can now choose between two modes:

### ADD (Default)
- Adds the specified values to the property
- Does NOT duplicate values if they already exist
- Preserves existing values in the property
- **Preserves the IF condition value** - will not remove it when adding new values

### REMOVE
- Removes the specified values from the property
- Only removes values that exist
- Preserves all other values in the property
- Safe: does nothing if the value doesn't exist

### OVERWRITE
- Completely replaces the property value with the specified new value
- Removes all existing values and sets only the new ones
- Useful for resetting or fully updating a property
- Warning: This will erase any existing data in the property

### DELETE PROPERTY
- Completely removes the property from the frontmatter
- The property and all its values are deleted permanently
- Warning: This action is irreversible and will permanently delete the property
- No value field is required, as nothing is being set

### How to use
In the rules editor, each THEN action has a dropdown between the property name and value field:
- Select **ADD** to add values (default behavior)
- Select **REMOVE** to remove values
- Select **OVERWRITE** to replace the entire property value
- Select **DELETE PROPERTY** to remove the property entirely

### Examples

**Add tags without duplicating:**
```
IF property: type, op: contains, value: meeting
THEN set property: tags [ADD] work, important
```
Result: Adds "work" and "important" tags only if they don't already exist.

**Remove old tags:**
```
IF property: status, op: contains, value: archived
THEN set property: tags [REMOVE] draft, wip
```
Result: Removes "draft" and "wip" tags if they exist.

**Overwrite property value:**
```
IF property: status, op: contains, value: old
THEN set property: status [OVERWRITE] new
```
Result: Replaces the entire "status" property with "new", removing any previous values.

**Delete a property:**
```
IF property: tags, op: contains, value: deprecated
THEN set property: old_tags [DELETE PROPERTY]
```
Result: Completely removes the "old_tags" property from the frontmatter.

**Combine ADD and REMOVE:**
```
IF property: tags, op: contains, value: old-project
THEN set properties:
  - tags [REMOVE] old-project, legacy
  - tags [ADD] new-project, active
  - status [ADD] migrated
```
Result: Removes old tags, adds new ones, and sets status.

## Rules

Each rule has:
- `ifProp`: source property name
- `op`: operator (`contains`, `notContains`)
- `ifValue`: value to test
- `thenActions`: array of actions to execute, each with `prop`, `value`, and `action` (add/remove/overwrite/delete)

### Examples

1) Rename a person mention in a multi-value property
```yaml
---
related_people: ["[[steve_works]]", "[[John Doe]]"]
---
```
Rule:
```
IF property: related_people, op: contains, value: [[steve_works]]
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

3) Ensure a property does not contain a value
```
IF property: source, op: notContains, value: transcript-auto
THEN set property: verified to true
```

4) Set multiple properties when a condition is met (NEW!)
```
IF property: tags, op: contains, value: meeting
THEN set properties:
  - status to processed
  - priority to high
```

5) Update multiple related properties
```
IF property: project_status, op: contains, value: completed
THEN set properties:
  - "status to done
  - "priority to low
  - "archived to true
```

6) Set multiple tags at once
```
IF property: type, op: contains, value: note
THEN set properties:
  - tags to work, apple, important
```

7) Use heading-based condition
```
IF heading first level, op: contains, value: Meeting
THEN set properties:
  - tags to meeting, important
```
*Note: The title is the first H1 heading after the YAML frontmatter, or the inline title if enabled. Rules are skipped for notes without a title.*

## Limitations
  - Only frontmatter is modified
  - Operators limited to containment (`contains`, `notContains`)
  - No folder/tag scoping yet

## Roadmap
  - Accept native obsidian variables like {{date}}
  - Change names of properties
  - Execute changes in the note content, not only propertie"
  - Advanced operators (regex, greater/less than)
  - Compound conditions (AND/OR/NOT)
  - Multiple actions per rule
  - Folder/tag scoping and new-note filters

## Privacy
All processing happens locally in your vault. No data leaves your device.

## License
MIT
