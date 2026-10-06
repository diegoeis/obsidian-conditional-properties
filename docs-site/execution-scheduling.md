---
title: Execution & Scheduling
nav_order: 8
---

# Execution & scheduling

## Run manually

- **Settings** → Conditional Properties → **Run now** — runs every rule against the current scan scope
- **Command palette** → "Run conditional rules on vault" (same as Run now) or "Run conditional rules on current file" (ignores scan scope, only processes the active file)

## Run this rule

Each rule also has its own **Run this rule** button, which runs just that one rule against the current scan scope, without touching any other rule. Its Stop button and loading state only apply to that rule — running one rule doesn't make other rules' rows look busy too.

## Stop button

Cancels a running scan. The file currently being processed finishes cleanly and the remaining files are skipped.

## Scheduled scans

Set a scan interval (minimum 5 minutes) in the settings, and the plugin runs automatically on that interval using your configured scan scope.

## Scan scopes

| Scope | What it processes |
|---|---|
| **Latest created** | The newest notes by creation date (default count: 15) |
| **Latest modified** | The most recently edited notes (default count: 15) |
| **Entire vault** | Every markdown note |

The note count (1–1000) is configurable for the two "latest" scopes — useful for running rules only against active notes instead of scanning your entire vault every time.

## Excluded files and folders
{: .d-inline-block }

New in v0.27.0
{: .label .label-green }

A multi-line field in the settings listing notes and folders the plugin must never touch. One path per line, relative to the vault root:

```
Templates
Archive/2024
Inbox/scratch.md
**/*.excalidraw.md
# lines starting with # are ignored
```

| Entry | Matches |
|---|---|
| `Templates` | Every note inside that folder, at any depth — and a note literally named `Templates.md` |
| `Inbox/scratch.md` | That exact note (the `.md` is optional) |
| `Daily/*.md` | Notes directly inside `Daily`, but not in its subfolders |
| `**/*.excalidraw.md` | Any note with that suffix, anywhere in the vault |
| `note?.md` | `note1.md`, `noteA.md` — `?` is a single character |

Leading and trailing slashes are ignored (`/Templates/` is the same as `Templates`) and matching is case-insensitive. Paths are matched literally — a `.` or `(` in a folder name is never interpreted as a regular expression.

Exclusions apply to **every** way a rule can run: scheduled scans, **Run now**, a single rule's **Run this rule**, and the "Run conditional rules on current file" command (which tells you the file was skipped). They're applied before the scan-scope slice, so excluding a folder frees up slots in a "latest N notes" scan instead of shrinking how many notes actually get processed.
