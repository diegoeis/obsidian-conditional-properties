---
title: Placeholders
nav_order: 6
---
{% raw %}

# Placeholders

Placeholders work inside **any THEN action value** — [Property actions](/actions/property-actions), [First level title actions](/actions/first-level-title-actions), and [Note file actions](/actions/note-file-actions). They're expanded at the moment the rule runs, against the file being processed, using Obsidian's own `{{...}}` Templates syntax.

## Reference

| Placeholder | Description | Result |
|---|---|---|
| `{{today}}` / `{{date}}` | Today's date — both names mean the same thing. | `YYYY-MM-DD` by default (e.g. `2026-09-04`), unless your vault has a custom Date format under Files & Links — then that format is used instead. |
| `{{time}}` | The current time. | `HH:mm` by default (e.g. `14:32`), unless your vault has a custom Time format — then that format is used instead. |
| `{{title}}` | The note's filename, without `.md`. | `meeting-notes` |
| `{{filename}}` | Same as `{{title}}` — the note's filename, without `.md`. | `meeting-notes` |
| `{{created_date}}` | The file's creation date. | `YYYY-MM-DD` by default, same formatting rules as `{{today}}`. |
| `{{updated_date}}` | The file's last-modified date. | `YYYY-MM-DD` by default, same formatting rules as `{{today}}`. |
| `{{propertyName}}` | The live value of any frontmatter property on the current note — replace `propertyName` with the actual property's name (e.g. `{{status}}`, `{{g_excerpt}}`). | Whatever that property currently holds. Arrays are joined with `, `; a missing property resolves to an empty string. |
| `{{match}}` / `{{match:N}}` / `{{match:name}}` | Beta — reuses whatever an IF regex condition matched. See [`{{match}}` in THEN](/actions/note-file-actions#match-in-then-beta). | The matched text, capture group `N`, or named group `name`. |

{: .note }
In [Note file actions](/actions/note-file-actions) (Rename file / Add name prefix / Add name suffix / Move file to), a bare date placeholder is always forced to `YYYY-MM-DD` regardless of the vault's date format — see [Dates are always date-only in Note file actions](#dates-are-always-date-only-in-note-file-actions) below.

## Custom formats

`{{today}}`, `{{date}}`, `{{created_date}}`, `{{updated_date}}`, and `{{time}}` all accept an optional `:FORMAT` suffix — e.g. `{{today:DD-MM-YYYY}}` — using [moment.js](https://momentjs.com/docs/#/displaying/format/) tokens. Without one, they fall back to the default (or vault-configured) format described in the table above.

```yaml
{{today:DD-MM-YYYY}}   → 04-09-2026
{{date:MM}}            → 09
{{time:HH:mm:ss}}      → 14:32:07
{{created_date:YYYY}}  → 2025
```

The most common tokens:

| Token | Meaning | Example |
|---|---|---|
| `YYYY` | 4-digit year | `2026` |
| `YY` | 2-digit year | `26` |
| `MMMM` | Full month name | `September` |
| `MMM` | Short month name | `Sep` |
| `MM` | 2-digit month | `09` |
| `M` | Month, no leading zero | `9` |
| `DD` | 2-digit day of month | `04` |
| `D` | Day of month, no leading zero | `4` |
| `dddd` | Full weekday name | `Friday` |
| `ddd` | Short weekday name | `Fri` |
| `HH` | 2-digit hour, 24h | `14` |
| `h` | Hour, 12h, no leading zero | `2` |
| `mm` | 2-digit minute | `32` |
| `ss` | 2-digit second | `07` |
| `A` | AM/PM | `PM` |

Mix tokens with any separator you like — `-`, `/`, spaces, text: `{{today:dddd, MMMM D YYYY}}` → `Friday, September 4 2026`. The full token list is in the [moment.js format docs](https://momentjs.com/docs/#/displaying/format/).

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

{% endraw %}
