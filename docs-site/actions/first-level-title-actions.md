---
title: First Level Title Actions
parent: Actions (THEN)
nav_order: 2
---

# First level title actions

Prefix, suffix, or overwrite the note's title — the H1 heading immediately after frontmatter (or the inline title if there's no H1 yet).

## Prefix

```yaml
THEN First level title: Add prefix "[ARCHIVED] "
```
Result: `[ARCHIVED] Original Title`.

## Suffix

```yaml
THEN First level title: Add suffix " - {{date}}"
```
Result: `Original Title - 2026-08-23`.

## Overwrite

```yaml
THEN First level title: Overwrite to "{{date:YYYY-MM-DD}} - {{title}}"
```
Result: `2026-01-08 - team-sync`.

## Placeholders

All three accept the full [Placeholders](/placeholders) set — dates, time, filename, frontmatter properties, and regex captures via `{{match}}`.
