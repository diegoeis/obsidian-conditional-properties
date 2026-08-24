---
title: Conditions (IF)
nav_order: 4
has_children: true
permalink: /conditions/
---

# Conditions (IF)

A rule's **IF** block decides which notes it applies to. A condition row has, in order: a **type** dropdown (what to check), a property-name field (Property conditions only), an **operator** dropdown (how to compare), and a **value** field (what to compare against) — the value field is skipped for `exists` / `does not exist` / `is empty`.

## Condition types

| Type | Checks | Page |
|---|---|---|
| **Property** | Any frontmatter property's value | [Property](/conditions/property) |
| **First level title** | The note's title — the H1 immediately after frontmatter (not Obsidian's separate "inline title" feature) | [First level title](/conditions/first-level-title) |
| **Note file** | The file's own name, or the folder(s) it lives in | [Note file](/conditions/note-file) |

## Six comparison operators

These are the exact labels in the operator dropdown for **Property** and **First level title** conditions. **Note file** conditions use a different, five-option dropdown instead — see [Note file](/conditions/note-file) — none of the six below apply there.

| Operator | Description | Example |
|----------|-------------|---------|
| `exactly match` | Exact match | `Property: type → exactly match → "meeting"` |
| `contains` | Substring match | `Property: name → contains → "Diego"` |
| `does not contain` | Does not contain | `Property: tags → does not contain → "draft"` |
| `exists` | Property present | `Property: status → exists` |
| `does not exist` | Property absent | `Property: reviewed → does not exist` |
| `is empty` | Empty value | `Property: tags → is empty` |

`exactly match`, `contains`, and `does not contain` also accept a `/regex/` value instead of a literal string — see [Regex Matching](/conditions/regex-matching).

## Combining conditions

A single rule can have more than one condition — see [Multiple Conditions](/conditions/multiple-conditions) for the **Match** dropdown's **Any of the following** (OR) vs **All of the following** (AND).

## Note

A later rule's condition sees property (or filename/folder) changes an earlier rule already made in the same scan — not just the state from before the scan started. See [Multiple Actions → Rule chaining within a scan](/actions/multiple-actions#rule-chaining-within-a-scan) for details.
