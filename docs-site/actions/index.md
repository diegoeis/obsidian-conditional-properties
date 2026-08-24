---
title: Actions (THEN)
nav_order: 4
has_children: true
permalink: /actions/
---

# Actions (THEN)

A rule's **THEN** block is what happens to a note once its IF conditions match. Every action has a **type** (what to change) and, depending on type, a specific operation and value.

## Action types

| Type | Changes | Page |
|---|---|---|
| **Property** | A frontmatter property | [Property Actions](/actions/property-actions) |
| **First level title** | The note's title (H1 / inline title) | [First Level Title Actions](/actions/first-level-title-actions) |
| **Note file** | The file itself — its name or which folder it's in | [Note File Actions](/actions/note-file-actions) |

## Multiple actions per rule

A single rule can chain several actions — see [Multiple Actions](/actions/multiple-actions) for execution order and how a later action can build on an earlier one in the same rule.

## Placeholders

Action values aren't limited to static text — reference the current date/time, the file's name, a frontmatter property, or a regex capture group inline. See [Placeholders](/placeholders).
