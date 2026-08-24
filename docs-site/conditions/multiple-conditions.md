---
title: Multiple Conditions
parent: Conditions (IF)
nav_order: 5
---

# Multiple conditions per rule

Combine conditions inside a single rule using the **Match** dropdown next to the IF block, set to **Any of the following** or **All of the following** (inspired by Zotero's condition UI).

## Match: All of the following — AND

```yaml
Match: All of the following
  Condition 1  Property: status → exactly match → "done"
  Condition 2  Property: priority → exactly match → "high"
THEN  Property: tags → Add value → urgent-completed
```
The rule only fires when **every** condition matches.

## Match: Any of the following — OR

```yaml
Match: Any of the following
  Condition 1  Property: status → exactly match → "archived"
  Condition 2  Property: deleted → exactly match → "true"
THEN  Property: tags → Remove value → active
```
The rule fires when **at least one** condition matches.

## Using it in the settings UI

Click **+ add condition** below the IF block to add more conditions, and use the **Match** dropdown to switch between **Any of the following** and **All of the following**. Existing rules from previous plugin versions are auto-migrated and keep their original behavior unchanged.

You can mix condition types freely — a `Match all` rule can combine a Property condition with a Note file condition, for example.
