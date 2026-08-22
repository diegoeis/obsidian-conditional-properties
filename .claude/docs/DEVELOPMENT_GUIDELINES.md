# Development Guidelines for Conditional Properties

> **Note:** This project uses Claude Code for AI-assisted development. See [`.claude/rules.md`](../rules.md) for the full set of project rules.

## ⚠️ CRITICAL: Always Follow Obsidian Official Documentation

**IMPORTANT**: Before implementing ANY feature, tool, API, method, or functionality:

1. **CHECK the official Obsidian documentation first**
   - Plugin Development Docs: https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin
   - API Reference: https://docs.obsidian.md/Reference/TypeScript+API
   - GitHub API repo: https://github.com/obsidianmd/obsidian-api

2. **USE the official Obsidian APIs and methods**
   - Don't assume how things work
   - Don't create workarounds when an official API exists
   - Follow the documented patterns

3. **VERIFY** your understanding
   - Read the TypeScript definitions (`obsidian.d.ts`) for the exact signature — useful even though this repo has no `node_modules`, since it's the authoritative source for what each method accepts and returns
   - Check example/community plugins for reference implementations
   - Test live in Obsidian (via `./scripts/sync.sh`, see root `CLAUDE.md`) before considering anything done

## No Build Step

This repo intentionally ships compiled JS directly — no `package.json`, no TypeScript, no bundler. `main.js` **is** the source. Don't introduce a build pipeline unless the user explicitly asks for one.

## Key Obsidian Features to Use Correctly

### 1. File Operations
- **Use**: the Vault/FileManager API — `app.vault.read()`, `app.vault.process()`, `app.fileManager.processFrontMatter()`, `app.fileManager.renameFile()`, `app.fileManager.trashFile()`
- **Don't**: touch Node's `fs` module directly, or write files by manually composing paths
- **Why**: the Vault/FileManager API handles permissions, link updates, and cache invalidation correctly; `renameFile`/`trashFile` in particular keep wikilinks elsewhere in the vault intact

### 2. Metadata Cache
- **Use**: `app.metadataCache.getFileCache(file).frontmatter` to read frontmatter
- **Don't**: parse YAML frontmatter manually from raw file content
- **Why**: the cache is kept in sync automatically and is far cheaper than re-reading + re-parsing the file

### 3. Frontmatter Writes
- **Use**: `app.fileManager.processFrontMatter(file, fm => { ... })`
- **Don't**: read the file, splice the YAML block by hand, and write it back — this is what earlier versions of this plugin did with `parseYaml`/`stringifyYaml`; `processFrontMatter` is the current, safer pattern and is what `main.js` uses today
- **Why**: it handles the case where the file has no frontmatter block yet, preserves key order/comments better, and avoids a whole class of malformed-YAML bugs

### 4. Settings Storage
- **Use**: `this.loadData()` and `this.saveData()`
- **Don't**: write settings to a file manually
- **Why**: Obsidian manages the plugin's data folder location for you (including on mobile, where the path differs)

### 5. Property types (checkbox / date / datetime)
- There is **no public API** for reading a property's registered widget type. This plugin uses `app.metadataTypeManager.getPropertyInfo()` (undocumented internal) for this, wrapped in `try/catch` with a safe fallback.
- Same story for reading the Daily Notes / Templates core-plugin date format: `app.internalPlugins.plugins["daily-notes"]` is undocumented.
- Treat both as fragile: keep the try/catch, and if a future Obsidian release removes or renames them, fail closed (fall back to `undefined`/raw string) rather than throwing.

## Documentation Resources

### Official Docs
- **Plugin Guidelines**: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- **Developer Policies**: https://docs.obsidian.md/Developer+policies (mirrored at [`OBSIDIAN_DEVELOPMENT_POLICIES.md`](OBSIDIAN_DEVELOPMENT_POLICIES.md))
- **Plugin Review checklist**: https://github.com/obsidianmd/obsidian-releases/blob/master/plugin-review.md
- **API Reference**: https://docs.obsidian.md/Reference/TypeScript+API
- **Sample Plugin**: https://github.com/obsidianmd/obsidian-sample-plugin
- **ESLint plugin** (useful to run locally against `main.js` even without a full TS build): https://github.com/obsidianmd/eslint-plugin

### Community Resources
- **Discord**: https://discord.gg/obsidianmd
- **Forum**: https://forum.obsidian.md/

## Code Review Principles

When reviewing code (AI or human):

1. **Verify against docs**: does this match an official Obsidian pattern?
2. **Check for a built-in feature first**: is there already an Obsidian API for this?
3. **Security**: does this stay inside the vault sandbox? Any user-entered or placeholder-expanded text that becomes part of a file path must be sanitized against `../` traversal (see `_sanitizeFilenameComponent` / `_sanitizeVaultFolderPath` in `main.js`).
4. **Performance**: are we using the metadata cache instead of re-reading files? Does a vault-wide scan stay responsive (await per file, respect `scanCount`)?
5. **User experience**: does the settings UI follow Obsidian's conventions (sentence case labels, `Setting`/`ButtonComponent`, no raw `innerHTML`)?

## Testing

Always test, live, via `./scripts/sync.sh`:

1. **Fresh install / reload**: does `obsidian plugin:reload id=conditional-properties` pick up the change?
2. **Settings changes**: do rule/condition/action edits persist through `saveData`/`loadData`?
3. **Migration**: does `_migrateRules()` correctly upgrade an older `data.json` shape?
4. **Error cases**: malformed rule (missing prop, empty text), file with no frontmatter, file with no H1 — all should no-op gracefully, never throw.
5. **Mobile**: this plugin is `isDesktopOnly: false`. Anything that touches the DOM directly (e.g. programmatic file download/upload in the settings tab) should be checked on Obsidian Mobile too, since browser-download patterns that work on desktop Electron don't always work in a mobile WebView.

## Common Pitfalls

### ❌ Don't
- Parse YAML manually
- Write files outside the Vault/FileManager API
- Use `innerHTML`, `eval()`, or dynamic code execution
- Block the main thread with a heavy synchronous loop
- Leave `console.log()` in committed code
- Touch note body content — this plugin's contract is frontmatter + title only

### ✅ Do
- Use `metadataCache` for frontmatter reads and `processFrontMatter` for writes
- Use the Vault/FileManager API for all file operations
- Use `async`/`await` throughout
- Validate/sanitize all user-entered and placeholder-expanded text
- Use `console.warn()`/`console.error()` for real error paths only

## Version Compatibility

- **Current minimum**: Obsidian 1.5.0 (see `manifest.json` / `versions.json`)
- **Check API availability** before relying on a newer method
- Since the plugin is not desktop-only, keep mobile in mind for anything DOM-related

## When in Doubt

1. **Read the docs**: start with official documentation
2. **Check the type definitions**: they're the authoritative source for signatures
3. **Look at examples**: the official sample plugin and popular community plugins
4. **Ask the community**: Discord or Forum
5. **Test thoroughly, live**: better to catch issues before a release

---

## Summary

**Always consult Obsidian's official documentation BEFORE implementing any feature.**

This prevents implementing non-standard solutions, missing built-in features, creating security vulnerabilities, breaking plugin guidelines, and failing plugin review.

**Documentation comes FIRST, implementation comes SECOND.**
