# File & Vault API Rules

Generic, portable across any Obsidian plugin repo.

Full text: [`.claude/docs/obsidian_plugin_guidelines.md`](../docs/obsidian_plugin_guidelines.md) (mirror of the [official plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)) — see the sections on `Vault.modify`, `FileManager.processFrontMatter`, vault iteration, and `normalizePath`.

## Rules

1. **Editor API for the active file** — preserves cursor position and undo history. Never `Vault.modify()` on the file currently open in an editor.
   ```javascript
   // ✅ CORRECT
   const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
   if (editor) editor.replaceRange(text, from, to);

   // ❌ WRONG — loses cursor position, jarring UX
   await this.app.vault.modify(file, newContent);
   ```
2. **`Vault.process()` for background edits to a file that isn't open** — atomic, avoids clobbering concurrent writes. Never `Vault.modify()` for this either.
3. **`FileManager.processFrontMatter()` for all frontmatter reads/writes** — handles missing frontmatter blocks and malformed YAML safely. Never hand-parse/splice YAML.
   ```javascript
   // ✅ CORRECT
   await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
     frontmatter[prop] = value;
   });
   ```
4. **`normalizePath()` for any user- or placeholder-derived path** — cross-platform (Windows vs. POSIX separators), and the first line of defense against path traversal.
5. **Direct file lookups over vault iteration** — `Vault.getFileByPath`/`getFolderByPath`/`getAbstractFileByPath` instead of walking `vault.getFiles()` when the path is already known.
6. **`Platform` API for OS/device detection** — never `navigator.userAgent`/`navigator.platform`.
7. **`app.metadataCache.getFileCache(file)`** for reading frontmatter/headings — never parse the raw file content for metadata Obsidian already indexes.

## This repo (Conditional Properties)

- Reads frontmatter via `metadataCache.getFileCache(file).frontmatter`, writes via `fileManager.processFrontMatter` — see [`CLAUDE.md`](../../CLAUDE.md) → Architecture → Persistence.
- `_sanitizeFilenameComponent()` / `_sanitizeVaultFolderPath()` in `main.js` roll their own traversal-stripping for Note file actions (rename/prefix/suffix/move) **on top of**, not instead of, `normalizePath()` — any change here must keep both layers.
- `app.metadataTypeManager` / `app.internalPlugins` are used for typed-property coercion and Daily Notes/Templates date-format detection because there's no public API for either. Both are wrapped in `try/catch` with a safe fallback since they're undocumented internals — keep it that way.
- `app.internalPlugins.plugins.bookmarks.instance` (items tree, `addItem`/`removeItem`/`onItemsChanged`) is used for the "Bookmark file" / "Remove bookmark" THEN actions — same undocumented-internal category, same try/catch + defensive `typeof fn === "function"` pattern (see `_applyBookmarkAction()`/`_listBookmarkGroups()` in `main.js`).
