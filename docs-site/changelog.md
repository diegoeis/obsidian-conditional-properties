---
title: Changelog
nav_order: 11
---

# Changelog

The full, unabridged history lives in [CHANGELOG.md on GitHub](https://github.com/diegoeis/obsidian-conditional-properties/blob/main/CHANGELOG.md). Highlights of recent releases:

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
