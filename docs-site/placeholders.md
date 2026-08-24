---
title: Placeholders
nav_order: 6
---

# Placeholders

Placeholders work inside **any THEN action value** — [Property actions](/actions/property-actions), [First level title actions](/actions/first-level-title-actions), and [Note file actions](/actions/note-file-actions). They're expanded at the moment the rule runs, against the file being processed, using Obsidian's own `{{...}}` Templates syntax.

## Reference

| Placeholder | Result |
|---|---|
| `{{today}}` / `{{date}}` | Today's date (both names mean the same thing). Default format is `YYYY-MM-DD`, unless your vault has a custom Date format under Files & Links — then that format is used instead. |
| `{{time}}` | Current time. Default format is `HH:mm`, unless your vault has a custom Time format — then that format is used instead. |
| `{{title}}` | The note's filename, without `.md`. Example: `meeting-notes`. |
| `{{created_date}}` | The file's creation date. |
| `{{updated_date}}` | The file's last-modified date. |
| `{{filename}}` | The note's filename, without `.md` (same value as `{{title}}`). |
| `{{propertyName}}` | The live value of that frontmatter property on the current note. |
| `{{match}}` / `{{match:N}}` / `{{match:name}}` | Beta — reuses whatever an IF regex condition matched. See [`{{match}}` in THEN](/actions/note-file-actions#match-in-then-beta). |

{: .note }
In [Note file actions](/actions/note-file-actions) (Rename file / Add name prefix / Add name suffix / Move file to), a bare date placeholder is always forced to `YYYY-MM-DD` regardless of the vault's date format — see [Dates are always date-only in Note file actions](#dates-are-always-date-only-in-note-file-actions) below.

## Custom formats

Append `:FORMAT` for a custom [moment.js](https://momentjs.com/docs/#/displaying/format/) date/time format:

```yaml
{{date:DD-MM-YYYY}}    → 23-08-2026
{{date:MM}}            → 08
{{time:HH:mm:ss}}      → 20:14:07
{{created_date:YYYY}}  → 2025
```

## Property placeholders

Any token that isn't one of the reserved names above, and whose first character isn't `:` or whitespace, is treated as a frontmatter property lookup: `{{g_excerpt}}`, `{{summary}}`, `{{kebab-case-prop}}` all work.

**Copy a value from one property to another:**
```yaml
IF    Property: g_excerpt → exists
THEN  Property: excerpt → Add value → "{{g_excerpt}}"
```

Behavior:
- **Missing property → empty string.** No errors, no literal `{{name}}` left behind in your YAML.
- **Arrays are joined with `, `.** A source like `tags: [a, b, c]` becomes `a, b, c` in the expanded string.
- **Earlier actions in the same rule are visible to later ones.** If action #1 sets `excerpt`, action #2 can reference `{{excerpt}}`.
- **Reserved names win.** `date`, `created_date`, `updated_date`, `today`, `time`, `title`, `filename`, and `match` are all resolved as reserved placeholders first; a property with one of those names won't shadow them. If you have a property literally named `match`, `{{match}}` always resolves via the [regex-capture logic](/actions/note-file-actions#match-in-then-beta) — never that property's value.

## Dates are always date-only in Note file actions

Inside [Rename / Add name prefix / Add name suffix / Move file to](/actions/note-file-actions), a **bare** date placeholder (no explicit `:FORMAT`) always resolves to `YYYY-MM-DD`, never a time component — file and folder names can't safely carry a `:` on every platform. An explicit format is always honored exactly as you typed it, including one with `:` in it.

## Combinations

Placeholders mix freely in the same value:

- `{{date:YYYY-MM-DD}} - {{title}}` → `2026-08-23 - meeting-notes`
- `Meeting {{title}} - {{date:DD/MM/YY}}` → `Meeting meeting-notes - 23/08/26`
- `{{date}}/{{title}}` as a Move file to destination → `2026-08-23/meeting-notes` (folder auto-created)
- `{{g_title}} ({{date:YYYY}})` → `My Post (2026)`
