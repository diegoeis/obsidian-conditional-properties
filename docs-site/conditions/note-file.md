---
title: Note file
parent: Conditions (IF)
nav_order: 3
---

# Note file condition

Checks the file itself — its name, or the folder(s) it lives in — instead of a frontmatter property or the title. Literal (non-regex) comparisons are case-insensitive. A `/regex/` value is case-**sensitive** instead, unless you add the `i` flag — see [Regex Matching](/conditions/regex-matching).

```yaml
IF  Note file: Filename contains → "draft"
```

The condition row is: **Note file** type → operator dropdown → value field (no separate property-name field — the file itself is what's being checked).

## Operators

| Operator | Checks against | Example |
|----------|-----------------|---------|
| `Filename contains` | `file.basename` (no extension) | filename contains "draft" |
| `Filename not contains` | `file.basename` | filename not contains "template" |
| `Filename exactly match` | `file.basename` | filename exactly "index" |
| `Parent folder is` | the folder path the file lives in | see below |
| `Parent folder is not` | the folder path the file lives in (inverted) | see below |

The three filename operators also accept a `/regex/`-wrapped value — see [Regex Matching](/conditions/regex-matching). `Parent folder is` / `Parent folder is not` always stay literal path matching; they don't accept regex.

## Parent folder is

Accepts either a single folder name or a partial path — enter the folder name(s) only, never a path starting with `/` from the vault root.

```yaml
IF  Note file: Parent folder is → "ClienteA"
```
Matches any note under a folder named `ClienteA`, at any depth — `ClienteA/notes/file.md` and `Projects/ClienteA/2026/file.md` both match.

```yaml
IF  Note file: Parent folder is → "meetings/transcripts/company"
```
Matches when those three segments appear contiguous and in that order anywhere in the file's folder path — e.g. `Work/meetings/transcripts/company/2026/file.md` matches, but `meetings/company/transcripts/file.md` does not (wrong order).

## Parent folder is not

The exact inverse of `Parent folder is` — same matching rules, opposite result. Useful to exclude a folder from a broader rule:

```yaml
IF    Note file: Parent folder is not → "Archive"
THEN  Note file: Add name prefix → "[ACTIVE] "
```
Runs on every note **except** those under an `Archive` folder anywhere in their path.

{: .note }
Leaving the value empty makes `Parent folder is` never match, and `Parent folder is not` always match — same "nothing to compare against" convention as the `does not contain` operator elsewhere in the plugin.
