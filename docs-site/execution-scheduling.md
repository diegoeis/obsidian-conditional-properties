---
title: Execution & Scheduling
nav_order: 7
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
