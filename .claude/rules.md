# Project Rules — Conditional Properties

## 🚨 CRITICAL: Documentation-First Development

### Rule 1: ALWAYS Consult Official Documentation Before Implementation

**NEVER assume how Obsidian APIs, methods, or features work. ALWAYS verify with official documentation FIRST.**

1. **Check official docs FIRST**: https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin
2. **Verify API reference**: https://docs.obsidian.md/Reference/TypeScript+API
3. **Check the type definitions** in the `obsidian` npm package's `obsidian.d.ts` (useful as a reference even though this repo has no `node_modules` — it documents the exact method signatures)
4. **Review plugin guidelines**: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
5. **Study the sample plugin**: https://github.com/obsidianmd/obsidian-sample-plugin

For submission specifics, see [`.claude/docs/OBSIDIAN_PLUGIN_SUBMISSION_GUIDE.md`](docs/OBSIDIAN_PLUGIN_SUBMISSION_GUIDE.md).

### Rule 2: No Assumptions Without Verification

Before implementing ANY feature:
- [ ] Read official documentation
- [ ] Check TypeScript type definitions for the exact method signature
- [ ] Look for existing plugin examples
- [ ] Verify the approach matches official patterns
- [ ] Test live in Obsidian via `./scripts/sync.sh` (see root `CLAUDE.md`) before considering it done

## 📝 Language and Communication Rules

### Rule 3: All Code-Related Text Must Be in English

**ALWAYS write in English:**
- ✅ Git commit messages
- ✅ Git release notes
- ✅ Code comments
- ✅ Documentation (README, CHANGELOG, etc.)
- ✅ Notices and error messages shown to users
- ✅ Variable and function names
- ✅ GitHub Pull Request titles and descriptions

**Conversation with the user can be in Portuguese, but every code artifact is in English.**

### Rule 4: Commit Message Standards

Follow Conventional Commits:

```
<type>: <description>

[optional body]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types**: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`

**Examples:**
- ✅ `feat: add "Note file" THEN action`
- ✅ `fix: sanitize note file paths against vault escape`
- ✅ `docs: update installation instructions in README`
- ❌ `Adicionado suporte para nova ação` (wrong language)
- ❌ `fixed stuff` (too vague)

## 🔒 Security Rules

### Rule 5: NEVER Expose Sensitive Information

**NEVER commit, log, or expose:**
- ❌ API keys, secrets, or tokens
- ❌ Passwords
- ❌ Private URLs or endpoints
- ❌ User data or personal information — this plugin only ever touches the user's own local vault; never log or surface frontmatter values, file paths, or vault content beyond what's needed for a `console.error` during debugging
- ❌ Internal system paths (use vault-relative paths in documentation and Notices)

This plugin has no network calls, no accounts, no telemetry — see [`.claude/docs/OBSIDIAN_DEVELOPMENT_POLICIES.md`](docs/OBSIDIAN_DEVELOPMENT_POLICIES.md). Keep it that way; any change that introduces `requestUrl`/network access must be flagged and disclosed in the README per that policy.

### Rule 6: Secure Coding Practices

**ALWAYS:**
- ✅ Use Obsidian's Vault/FileManager APIs for all file operations (`fileManager.processFrontMatter`, `fileManager.renameFile`, `fileManager.trashFile`, `vault.read`)
- ✅ Sanitize any user-entered or placeholder-expanded text that becomes part of a file path (see `_sanitizeFilenameComponent` / `_sanitizeVaultFolderPath` in `main.js` — path traversal via `../` must never be able to move or write a file outside the vault)
- ✅ Validate/guard against missing files, missing frontmatter, and malformed rules — fail closed (skip the file) rather than throwing
- ✅ Handle errors gracefully with `console.error` + a user-facing `Notice`, never a silent failure and never an uncaught exception

**NEVER:**
- ❌ Use `eval()`, `new Function()`, or any dynamic code execution
- ❌ Use `innerHTML` — build DOM with `createEl`/`createDiv`
- ❌ Use `fetch()` — this plugin currently makes no network calls at all; if that ever changes, use `requestUrl()`
- ❌ Parse YAML frontmatter manually — use `app.metadataCache.getFileCache(file).frontmatter` for reads and `fileManager.processFrontMatter` for writes

## 🏗️ Development Best Practices

### Rule 7: Use Official Obsidian APIs

**File operations**: `app.vault.read()`, `app.vault.process()`, `app.fileManager.processFrontMatter()`, `app.fileManager.renameFile()`, `app.fileManager.trashFile()` — never Node's `fs` module directly.

**Metadata**: `app.metadataCache.getFileCache(file)` — never parse frontmatter by hand.

**Settings**: `this.loadData()` / `this.saveData()` — never write settings to disk manually.

**Property types**: `app.metadataTypeManager` and `app.internalPlugins` are used (for typed-property coercion and Daily Notes/Templates date-format detection) because there is no public API for either. Both calls are wrapped in `try/catch` with a safe fallback — keep it that way, since these are undocumented internals that can change between Obsidian versions without notice.

### Rule 8: No Build Step — This Repo Ships Compiled JS Directly

Unlike most Obsidian plugins, **this repo has no `package.json`, no TypeScript, no bundler**. `main.js` is edited directly and is exactly what Obsidian loads. There is no `npm run build`, no `npm run dev`, no lint script to run before committing (see `.claude/rules/obsidian-plugin-rules.md` for which of the 27 community-review rules still apply to plain JS vs. which are TypeScript-specific and don't apply here).

Before any release:
- [ ] Test live via `./scripts/sync.sh` against the dev vault
- [ ] No stray `console.log()` — `console.error()`/`console.warn()` only, and only for real error paths
- [ ] `manifest.json` version bumped, `versions.json` updated
- [ ] `CHANGELOG.md` appended with what + why

### Rule 9: Code Quality Standards

**ALWAYS:**
- ✅ Handle all promise rejections (`try/catch` around `await`)
- ✅ Provide clear, user-facing error messages via `Notice`
- ✅ Use `async`/`await` for asynchronous operations
- ✅ Clean up subscriptions (`onScanStateChange` unsubscribers) when a settings tab is hidden — see `hide()` / `_teardownScanSubscriptions()` in `main.js`
- ✅ Test on an actual Obsidian installation before release (see root `CLAUDE.md`'s live-test loop)

**NEVER:**
- ❌ Leave `console.log()` in committed code
- ❌ Block the main thread with a heavy synchronous loop over the whole vault — scans already iterate file-by-file with `await` so the UI stays responsive
- ❌ Skip error handling around file I/O

## 📦 Release Process

### Rule 10: Release Checklist

Full mechanics are in root `CLAUDE.md` → **Release**. Summary:

1. **Code Quality**: no stray `console.log()`, feature tested live via `./scripts/sync.sh`.
2. **Documentation**: `README.md`, `CHANGELOG.md`, `.claude/docs/features-info.md` (if it changes user-facing behavior), and any related PRD/FRD under `.claude/docs/product/` updated.
3. **Versioning**: `manifest.json` version bumped, `versions.json` mapping added.
4. **Git**: all changes committed in English, tag created **without** a `v` prefix (`X.Y.Z`, not `vX.Y.Z`), pushed only on the push that publishes the release.
5. **GitHub Release**: publish a release from the tag — the `release.yml` workflow zips `manifest.json`, `main.js`, `styles.css` automatically.

## 🎯 Project-Specific Rules

### Rule 11: Rule Engine Contract

- The plugin's contract is **frontmatter and titles only** — never touch note body content beyond the H1 title line immediately after frontmatter (see root `CLAUDE.md`'s "Recent fixes" section on H1 detection).
- `exists`, `notExists`, and `isEmpty` operators ignore `ifValue` — don't add UI or logic that requires a value for them.
- Note file actions (`rename`/`addPrefix`/`addSuffix`/`move`) must stay sanitized against path traversal; a `delete` action always stops further processing for that file in the current scan, since the file no longer exists.
- Never drop the 5-minute minimum scan interval floor.

### Rule 12: Testing Requirements

**Before any release, test:**
- [ ] Fresh plugin load (`obsidian plugin:reload id=conditional-properties`)
- [ ] Settings tab renders and every control (rules, conditions, actions) round-trips through `saveData`/`loadData`
- [ ] `_migrateRules()` correctly upgrades a `data.json` from an older schema version
- [ ] "Run now", "Run current file", and "Stop" commands behave correctly, including mid-scan cancellation
- [ ] Note file actions (rename/prefix/suffix/move/delete) never write outside the vault, even with adversarial placeholder input (`../`, absolute paths)

## 📚 Reference Links

**Obsidian:**
- Docs: https://docs.obsidian.md
- Plugin API: https://docs.obsidian.md/Reference/TypeScript+API
- Sample Plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- Plugin Guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Developer Policies: https://docs.obsidian.md/Developer+policies
- Community Plugins repo: https://github.com/obsidianmd/obsidian-releases

**Development:**
- Conventional Commits: https://www.conventionalcommits.org/

---

## 🔄 When in Doubt

1. **Read the official documentation FIRST**
2. **Check the TypeScript definitions for the actual API signature**, even though this repo ships plain JS
3. **Look at the official sample plugin**
4. **Ask the user for clarification if the request is ambiguous or the impact is non-trivial**
5. **Test live before considering anything done**

**Documentation comes FIRST, implementation comes SECOND.**
