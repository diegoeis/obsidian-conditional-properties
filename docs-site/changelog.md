---
title: Changelog
nav_order: 11
---
{% raw %}

# Changelog

The full, unabridged history lives in [CHANGELOG.md on GitHub](https://github.com/diegoeis/obsidian-conditional-properties/blob/main/CHANGELOG.md). Highlights of recent releases:

## 0.26.0

- IF condition values now accept the same [placeholders](/placeholders) as THEN actions — `{{today}}`, `{{propertyName}}`, and friends — resolved against the file before the comparison runs.
- New `{{yesterday}}` / `{{tomorrow}}` placeholders, alongside `{{date}}`.
- Rule search now also searches THEN action fields (property name/value, title text, note file text/bookmark group), not just the IF condition.
- New onboarding empty state with zero rules — a welcome message and its own "Add rule" button, replacing the search bar and empty list.
- Fixed a docs-site bug where `{{...}}` placeholder examples on the Note file condition page were silently eaten by Jekyll's Liquid engine, plus several broken internal links on the home page.

## 0.25.4

- Condition/action rows restyled: no border on the rule card, one-line layout, and labels changed from "Condition 1"/"Action 1" to a sentence-like **Where** (first condition), **Or**/**And** (every following condition, matching Any/All), and **Do this** (every action).

## 0.25.3

- **Rule search** — a condition-type dropdown (Property / First level title / Note file) plus a live-filter search field, right under the Rules heading. See [Backup & Restore](/backup-restore#rule-search).

## 0.25.0 – 0.25.2

- **"Bookmark file" and "Remove bookmark"** Note file actions, backed by Obsidian's core Bookmarks plugin, with a group picker. See [Note File Actions](/actions/note-file-actions).
- **"Latest export" path** shown under Backup and restore after exporting — the full OS filesystem path on desktop.
- **Critical fix**: a settings-migration bug that could silently rewrite `contains` conditions to `exactly` for anyone still on an old schema version — fixed, each migration step now gated to its own version range.
- Scan-interval changes apply immediately, no Obsidian restart needed; every settings field debounces its save instead of writing on every keystroke.
- Performance: title lookups read Obsidian's metadata cache first instead of the file from disk; compiled regex conditions are cached; dark-mode color fixes; accessibility fix for condition/action row labels.

## 0.24.2

- Settings tab UI rebuilt on native Obsidian patterns (setting-group/setting-items shell, batched DOM build, `cp-*` class naming). No behavior change.
- Documentation rewritten so every example mirrors the settings screen's exact dropdown labels and field order.
- Placeholder documentation and settings-field hints are double-brace only (`{{date}}`, `{{propertyName}}`, …) going forward.

## 0.24.1

- Renamed "First level heading" (IF) and "First heading" (THEN) to **First level title**, on both sides, for a consistent name. UI label only — existing rules are unaffected.

## 0.24.0

- Regular expression matching in IF conditions (`/pattern/flags`) on Property, First level title, and Note file (filename) conditions.
- 🧪 Beta: `{{match}}` / `{{match:N}}` / `{{match:name}}` — reuse an IF regex's match in THEN actions.
- Obsidian Templates-style `{{...}}` placeholder syntax.
- New placeholders: `{{time}}` and `{{title}}`.
- Fixed "Run this rule" making every other rule's row look like it was running too.

## 0.23.x

- `Parent folder is not` — the inverse of `Parent folder is`.
- `Move file to` renamed from `Move file` and documented as auto-creating its destination folder.
- Note file actions (Rename / Add prefix / Add suffix / Move file to) always resolve a bare date placeholder to `YYYY-MM-DD`, regardless of the vault's configured date format.

## 0.22.0 and earlier

Note file conditions (`Filename contains`, `Filename not contains`, `Filename exactly match`, `Parent folder is`), Note file actions (rename, prefix, suffix, move, delete), multiple conditions per rule (`match any` / `match all`), typed property awareness (checkbox / date / datetime) on both IF and THEN, and the original rule engine. See [CHANGELOG.md](https://github.com/diegoeis/obsidian-conditional-properties/blob/main/CHANGELOG.md) for the complete version-by-version history back to `0.1.0`.

## Roadmap

Not built yet, tracked in [README.md's Roadmap section](https://github.com/diegoeis/obsidian-conditional-properties#roadmap):

- Modify note content (beyond frontmatter)
- Comparison operators (greater than / less than)
- Nested condition groups (e.g. `(A AND B) OR C`)
- Folder/tag-based scoping

{% endraw %}
