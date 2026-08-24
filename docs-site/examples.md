---
title: Examples
nav_order: 3
---

# Examples

A cookbook of rules, from a single condition/action to combinations of several features at once. Every example is a complete rule you can recreate in Settings → Conditional Properties → Add rule.

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Simple

### Auto-tag meetings

```yaml
IF    Property: type → exactly match → "meeting"
THEN  Property: tags → Add value → work, important
```
Any note with `type: meeting` gets `tags: [work, important]` added, without duplicating values on repeated runs.

### Archive by status

```yaml
IF    Property: status → exactly match → "archived"
THEN  Property: tags → Remove value → active, wip
```

### Clean up a deprecated property

```yaml
IF    Property: tags → contains → "old-project"
THEN  Property: legacy_data → Delete property
```

### Tag by title

```yaml
IF    First level title: contains → "Meeting"
THEN  Property: tags → Add value → meeting, important
```

See [Conditions (IF)](/conditions/) and [Actions (THEN)](/actions/) for the full list of condition/action types.

---

## Intermediate

### Date-stamp completed tasks

```yaml
IF    Property: status → exactly match → "done"
THEN  First level title: Add suffix → " - {{date}}"
```
Uses a [placeholder](/placeholders) to append today's date to the title.

### Standardize meeting note titles

```yaml
IF    First level title: contains → "Meeting"
THEN  First level title: Overwrite to → "{{date:YYYY-MM-DD}} - {{title}}"
```
Result: `2026-01-08 - team-sync`.

### Sort transcripts into a dated folder

```yaml
IF    Note file: Filename contains → "transcript"
THEN  Note file: Move file to → "transcripts/{{date}}"
```
[Note file actions](/actions/note-file-actions) auto-create the destination folder — `transcripts/2026-08-24/` gets created the first time this runs.

### Copy one property into another

```yaml
IF    Property: g_excerpt → exists
THEN  Property: excerpt → Add value → "{{g_excerpt}}"
```
[Property placeholders](/placeholders#property-placeholders) let an action's value reference any other property on the same note.

### Chain several actions in one rule

```yaml
IF    Property: project_status → exactly match → "completed"
THEN:
  - Property: status → Overwrite all values with → "done"
  - Property: tags → Add value → archived
  - Property: tags → Remove value → active, wip
  - Property: priority → Add value → low
```
See [Multiple Actions](/actions/multiple-actions) for execution order.

### Typed checkbox + date together

```yaml
IF    Property: status → exactly match → "done"
THEN:
  - Property: completed → Overwrite all values with → "true"
  - Property: completed_at → Overwrite all values with → "{{date}}"
```
`completed` is written as a real boolean and `completed_at` as an ISO date, matching Obsidian's native widgets — see [Typed Properties](/typed-properties).

---

## Advanced

### Match all + exclude a folder

```yaml
Match: All of the following
  Condition 1  Property: status → exactly match → "done"
  Condition 2  Note file: Parent folder is not → "Archive"
THEN  Note file: Add name prefix → "[DONE] "
```
Combines a [Property condition](/conditions/property) with a [Note file condition](/conditions/note-file) in one `Match all` rule — only prefixes notes that are done *and* not already archived. See [Multiple Conditions](/conditions/multiple-conditions).

### Extract a date from the filename and use it to move the file

```yaml
IF    Note file: Filename contains → /\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])/
THEN  Note file: Move file to → "transcripts/{{match}}"
```
The [regex](/conditions/regex-matching) finds a date like `2026-08-24` in the filename, and [`{{match}}`](/actions/note-file-actions#match-in-then-beta) reuses it in the THEN action — no need to write the date twice.

### Named capture groups for a year/month archive

```yaml
IF    Note file: Filename contains → /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/
THEN  Note file: Move file to → "archive/{{match:year}}/{{match:month}}"
```
Sorts files into `archive/2026/08/`-style folders based on a date embedded in the filename, using named capture groups.

### Rule chaining across two rules in one scan

```yaml
Rule 1:
  IF    Property: status → exactly match → "done"
  THEN  Property: tags → Add value → completed

Rule 2:
  IF    Property: tags → contains → "completed"
  THEN  Note file: Move file to → "done/{{date:YYYY-MM}}"
```
Rule 2 fires in the **same scan** Rule 1 added the `completed` tag — no second run needed. See [Rule chaining within a scan](/actions/multiple-actions#rule-chaining-within-a-scan).

### Full pipeline: regex title match, typed property, rename, and archive

```yaml
Match: All of the following
  Condition 1  First level title: contains → /\d{4}-\d{2}-\d{2}/
  Condition 2  Note file: Parent folder is → "meetings"
THEN:
  - Property: type → Overwrite all values with → "meeting"
  - Property: reviewed → Overwrite all values with → "false"
  - Note file: Rename file → "{{match}} - {{title}}"
  - Note file: Move file to → "meetings/{{date:YYYY}}"
```
Combines a [regex](/conditions/regex-matching) condition, a [Note file condition](/conditions/note-file), [typed property](/typed-properties) coercion (`reviewed` written as boolean if registered as checkbox), [`{{match}}`](/actions/note-file-actions#match-in-then-beta) reuse in a rename, and a [Note file action](/actions/note-file-actions) that auto-creates a year-based archive folder — all in one rule.

### Exclude archived notes while auto-tagging by multiple signals

Nested condition groups like `(A OR B) AND C` aren't supported in a single rule yet (see the [Roadmap](/changelog#roadmap)) — but you can get the same result with two separate rules that share a condition and a THEN action:

```yaml
Rule 1:
  Match: All of the following
    Condition 1  Property: type → exactly match → "meeting"
    Condition 2  Note file: Parent folder is not → "Archive"
  THEN  Property: tags → Add value → meeting, needs-review

Rule 2:
  Match: All of the following
    Condition 1  First level title: contains → "Meeting"
    Condition 2  Note file: Parent folder is not → "Archive"
  THEN  Property: tags → Add value → meeting, needs-review
```
Either rule fires the same THEN action, so a note matching by `type` *or* by title — as long as it's outside `Archive` — ends up with the same tags. `ADD` never duplicates a value, so a note that satisfies both rules doesn't end up with `meeting` listed twice.
