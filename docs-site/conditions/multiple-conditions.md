---
title: Multiple Conditions
parent: Conditions (IF)
nav_order: 5
---

# Multiple conditions per rule

Combine conditions inside a single rule using **Match any / Match all of the following** (inspired by Zotero's condition UI).

## Match all — AND

```yaml
Match all of the following:
  - property: status exactly "done"
  - property: priority exactly "high"
THEN ADD tags: urgent-completed
```
The rule only fires when **every** condition matches.

## Match any — OR

```yaml
Match any of the following:
  - property: status exactly "archived"
  - property: deleted exactly "true"
THEN REMOVE tags: active
```
The rule fires when **at least one** condition matches.

## Using it in the settings UI

Click **+ add condition** below the IF block to add more conditions, and use the dropdown to switch between `any` and `all`. Existing rules from previous plugin versions are auto-migrated and keep their original behavior unchanged.

You can mix condition types freely — a `Match all` rule can combine a Property condition with a Note file condition, for example.
