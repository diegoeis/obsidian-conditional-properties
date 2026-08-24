---
title: Multiple Actions
parent: Actions (THEN)
nav_order: 4
---

# Multiple actions per rule

Chain several actions in one rule to automate a whole workflow at once.

```yaml
THEN:
  - OVERWRITE property: status = "done"
  - ADD tags: archived
  - REMOVE tags: active, wip
```

Actions run in the order listed. Property and title actions are batched in memory and only written to disk once, after **every rule** has finished running against that file in the current scan — not after each individual rule. [Note file actions](/actions/note-file-actions) are the exception: they execute immediately and compose in sequence, so a later Note file action (in this rule or a later one) sees the result of an earlier one right away.

## Rule chaining within a scan

This isn't limited to actions inside one rule — it also applies **across rules** in the same scan. A later rule's IF condition sees property (or filename/folder) changes an earlier rule already made in the same run, not just the frontmatter as it was before the scan started.

```yaml
Rule 1: IF property: status exactly "done"            THEN ADD tags: completed
Rule 2: IF property: tags contains "completed"  THEN ADD priority: low
```
Rule 2 fires in the same pass Rule 1 added the tag — no second scan needed.

The same applies to [Note file](/conditions/note-file) conditions: if an earlier rule renamed or moved a file, a later rule's Note file condition checks the file's **current** name/folder, not what it was before the scan started.
