---
title: Note File Actions
parent: Actions (THEN)
nav_order: 3
---

# Note file actions

Change the file itself instead of a frontmatter property or the title. All text fields accept the full [Placeholders](/placeholders) set.

## Actions

| Action | Effect |
|--------|--------|
| **Rename file** | Replaces the entire filename (keeps the extension) with the text you enter. Left empty → skipped, the rest of the rule's actions still run. |
| **Add name prefix** | Prepends text to the current filename. Empty text is a no-op. |
| **Add name suffix** | Appends text to the current filename. Empty text is a no-op. |
| **Move file to** | Moves the file to a folder path inside the vault. **The folder is created automatically if it doesn't exist.** Left empty → skipped. Moving outside the vault isn't possible — Obsidian's plugin API has no access beyond the vault sandbox. |
| **Bookmark file** | Bookmarks the file using Obsidian's core **Bookmarks** plugin. A second dropdown lets you file it into an existing bookmark group (including nested ones, shown as `Parent/Child`), or leave it at "No group (top level)". Running the rule again on an already-bookmarked file is a no-op — it never creates a duplicate bookmark. |
| **Remove bookmark** | Removes the file's bookmark wherever it exists in the Bookmarks tree — any group, or top level. No-op if the file isn't bookmarked. |
| **Delete file** | Sends the file to trash using your vault's configured deletion behavior (system trash, `.trash` folder, or permanent — whatever you set in Obsidian's Files & Links settings). |

All of these run through the official Obsidian API: `fileManager.renameFile` for rename/prefix/suffix/move (so links elsewhere in the vault stay intact), `fileManager.trashFile` for delete, and the core **Bookmarks** plugin's own internal state for bookmark/remove bookmark.

## Bookmark file requires the core Bookmarks plugin

**Bookmark file** and **Remove bookmark** read and write Obsidian's core **Bookmarks** plugin — enable it under Settings → Core plugins → Bookmarks. The group dropdown lists every group already in your Bookmarks pane; create the group there first if you want to file notes into it. If Bookmarks is disabled, the group dropdown is empty and the action is silently skipped (logged to the developer console) rather than failing the whole scan.

## Move file to: auto-creates the destination folder

You never need to pre-create the destination — combine it with a date placeholder to sort files into folders that don't exist yet:

```yaml
IF    Note file: Filename contains → "transcript"
THEN  Note file: Move file to → "transcripts/{{date}}"
```
This moves any note whose filename contains `transcript` into `transcripts/YYYY-MM-DD/` (today's date), creating both `transcripts/` and the dated subfolder the first time it runs, and reusing them on later runs the same day. Use `{{date:YYYY-MM}}` instead of `{{date}}` for one folder per month.

## Bare date placeholders are always date-only here

A bare date placeholder (`{{date}}`, `{{created_date}}`, `{{updated_date}}`, `{{today}}` — no explicit `:FORMAT`) always resolves to `YYYY-MM-DD` in these fields, never a time component, regardless of your vault's configured default date format. An explicit format is always honored exactly as typed, including one with `:` in it. See [Placeholders](/placeholders#dates-are-always-date-only-in-note-file-actions).

## Multiple file actions compose in sequence

Each file action executes immediately, so a later action in the same rule sees the result of an earlier one:

```yaml
THEN:
  - Note file: Add name prefix → "[ARCHIVED] "
  - Note file: Move file to → "Archive/{{date:YYYY}}"
```
The file is prefixed first, then the already-renamed file is moved.

## Delete stops everything else for that file

If a "Delete file" action runs — in this rule or an earlier one in the same scan — no further actions or rules execute against that file, since it no longer exists.

## `{{match}}` in THEN (Beta)

Reuse whatever your IF regex condition matched — no need to retype the pattern in the THEN action. Available in property values, First level title actions, and Note file actions.

| Placeholder | Resolves to |
|---|---|
| `{{match}}` | The full text matched by the pattern |
| `{{match:1}}`, `{{match:2}}`, … | Numbered capture group `(...)` — non-capturing groups `(?:...)` don't count |
| `{{match:name}}` | Named capture group, from a pattern written as `(?<name>...)` |

```yaml
IF    Note file: Filename contains → /\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])/
THEN  Note file: Move file to → "transcripts/{{match}}"
```
Moves any file whose name contains a date like `2026-08-22` into `transcripts/2026-08-22/`, auto-creating the folder — no need to duplicate the date pattern on the THEN side.

Named groups work the same way:
```yaml
IF    Note file: Filename contains → /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/
THEN  Note file: Move file to → "transcripts/{{match:year}}/{{match:month}}"
```

{: .warning }
**Current limitations (beta):**
- `{{match}}` reads from the **first** regex-mode condition (in the order you listed them) that was the reason the rule matched. A rule with multiple conditions doesn't expose more than one condition's captures.
- Not supported yet for a Property condition whose value is a **list** (e.g. `tags`) — regex still matches against list items, but there's no single scalar to pull a capture from. Property (single value), First level title, and Note file (filename) conditions are supported.
- Double-brace only (`{{match}}`) — this placeholder has no single-brace form.
- If the rule had no matching regex condition, or you reference a group/name that doesn't exist in the pattern, `{{match...}}` resolves to an empty string rather than erroring.
