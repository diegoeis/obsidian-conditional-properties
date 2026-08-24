---
title: Conditions (IF)
nav_order: 4
has_children: true
permalink: /conditions/
---

# Conditions (IF)

A rule's **IF** block decides which notes it applies to. Every condition has three parts: a **type** (what to check), an **operator** (how to compare), and a **value** (what to compare against) — except `exists` / `notExists` / `isEmpty`, which don't need a value.

## Condition types

| Type | Checks | Page |
|---|---|---|
| **Property** | Any frontmatter property's value | [Property](/conditions/property) |
| **First level title** | The note's title — the H1 immediately after frontmatter (not Obsidian's separate "inline title" feature) | [First level title](/conditions/first-level-title) |
| **Note file** | The file's own name, or the folder(s) it lives in | [Note file](/conditions/note-file) |

## Six comparison operators

| Operator | Description | Example |
|----------|-------------|---------|
| `exactly` | Exact match | `type exactly "meeting"` |
| `contains` | Substring match | `name contains "Diego"` |
| `notContains` | Does not contain | `tags notContains "draft"` |
| `exists` | Property present | `status exists` |
| `notExists` | Property absent | `reviewed notExists` |
| `isEmpty` | Empty value | `tags isEmpty` |

`exactly`, `contains`, and `notContains` also accept a `/regex/` value instead of a literal string — see [Regex Matching](/conditions/regex-matching).

## Combining conditions

A single rule can have more than one condition — see [Multiple Conditions](/conditions/multiple-conditions) for `Match any` (OR) vs `Match all` (AND).

## Note

A later rule's condition sees property (or filename/folder) changes an earlier rule already made in the same scan — not just the state from before the scan started. See [Multiple Actions → Rule chaining within a scan](/actions/multiple-actions#rule-chaining-within-a-scan) for details.
