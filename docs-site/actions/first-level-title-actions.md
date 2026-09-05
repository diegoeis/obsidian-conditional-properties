---
title: First Level Title Actions
parent: Actions (THEN)
nav_order: 2
---
{% raw %}

# First level title actions

Prefix, suffix, or overwrite the note's title — the H1 heading immediately after frontmatter (not Obsidian's separate "inline title" feature; see [First level title condition](/conditions/first-level-title) for the distinction).

The action row is: **First level title** type → modification dropdown (`Add prefix` / `Add suffix` / `Overwrite to`) → text field.

| Action | Effect |
|--------|--------|
| **Add prefix** | Prepends text to the title. Requires an existing H1 — silently skipped if the note has none. |
| **Add suffix** | Appends text to the title. Requires an existing H1 — silently skipped if the note has none. |
| **Overwrite to** | Replaces the title entirely. Works even with no H1 yet — inserts one right after the frontmatter (or at the top of the note). |

## Add prefix

```yaml
THEN  First level title: Add prefix → "[ARCHIVED] "
```
Result: `[ARCHIVED] Original Title`.

## Add suffix

```yaml
THEN  First level title: Add suffix → " - {{date}}"
```
Result: `Original Title - 2026-08-23`.

{: .note }
**Add prefix and Add suffix require an H1 to already exist.** If the note has no H1 immediately after frontmatter, these two are silently skipped — nothing is added. Use **Overwrite to** if you want to create a title where none exists yet.

## Overwrite to

```yaml
THEN  First level title: Overwrite to → "{{date:YYYY-MM-DD}} - {{title}}"
```
Result: `2026-01-08 - team-sync`.

Unlike Add prefix/Add suffix, Overwrite to works even when the note has no H1 yet — it inserts one right after the frontmatter (or at the top of the note, if there's no frontmatter either).

## Placeholders

All three accept the full [Placeholders](/placeholders) set — dates, time, filename, frontmatter properties, and regex captures via `{{match}}`.

{% endraw %}
