---
title: First level title
parent: Conditions (IF)
nav_order: 2
---
{% raw %}

# First level title condition

Checks the note's title — the H1 heading immediately after the frontmatter block, or at the very top of the note if there's no frontmatter. Only an H1 at the very top counts; an H1 further down the note is not treated as the title.

{: .warning }
This is **not** the same as Obsidian's separate "inline title" feature (the editable title shown at the top of the editor, normally derived from the filename). The plugin never reads that — only an actual `#` H1 line counts, and only when there's nothing but whitespace before it.

```yaml
IF  First level title: contains → "Meeting"
```

The condition row is: **First level title** type → operator dropdown → value field (no separate property-name field). All [six operators](/conditions/#six-comparison-operators) work here:

```yaml
IF  First level title: exists
IF  First level title: is empty
```
**exists** / **is empty** treat a missing H1 as "doesn't exist" / "is empty" respectively — useful for finding notes that never got a title. This is different from a [Property](/conditions/property) condition, where **is empty** on a *missing* property returns `false` rather than `true`.

{: .important }
**`exactly match` / `contains` / `does not contain` are case-sensitive** — same as [Property](/conditions/property) conditions.

## Regex matching

**exactly match**, **contains**, and **does not contain** accept a `/pattern/flags` value. See [Regex Matching](/conditions/regex-matching) for full syntax.

```yaml
IF  First level title: contains → /\d{4}-\d{2}-\d{2}/
```
Matches a title like "Nota da reunião 2026-08-22 com John Doe" — the plugin finds the date `2026-08-22` inside the text. Capture groups from a match here are available in THEN actions via [`{{match}}`](/actions/note-file-actions#match-in-then-beta).

{% endraw %}
