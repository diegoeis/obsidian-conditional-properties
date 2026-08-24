---
title: First level title
parent: Conditions (IF)
nav_order: 2
---

# First level title condition

Checks the note's title — the H1 heading immediately after the frontmatter block, or the note's inline title if there's no frontmatter. Only an H1 at the very top counts; an H1 further down the note is not treated as the title.

```yaml
IF First level title contains "Meeting"
```

All [six operators](/conditions/#six-comparison-operators) work here:

```yaml
IF First level title exists
IF First level title isEmpty
```
`exists` / `isEmpty` treat a missing H1 as "doesn't exist" / "is empty" respectively — useful for finding notes that never got a title.

## Regex matching

`exactly`, `contains`, and `notContains` accept a `/pattern/flags` value. See [Regex Matching](/conditions/regex-matching) for full syntax.

```yaml
IF First level title contains /\d{4}-\d{2}-\d{2}/
```
Matches a title like "Nota da reunião 2026-08-22 com John Doe" — the plugin finds the date `2026-08-22` inside the text. Capture groups from a match here are available in THEN actions via [`{{match}}`](/actions/note-file-actions#match-in-then-beta).
