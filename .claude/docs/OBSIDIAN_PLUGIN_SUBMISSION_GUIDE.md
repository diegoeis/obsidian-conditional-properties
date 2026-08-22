# Obsidian Community Plugin Submission Guide

This guide walks through submitting **Conditional Properties** (or a new version of it) to the Obsidian Community Plugins directory. Adapted from the general Obsidian submission process for this repo's specifics — no build step, plain-JS `main.js`.

## Prerequisites Checklist

Before submitting, ensure you have:

- [ ] Public GitHub repository: `https://github.com/diegoeis/obsidian-conditional-properties`
- [ ] A release published with:
  - [ ] `main.js` — the plugin code (edited directly, no build artifact)
  - [ ] `manifest.json` — plugin metadata
  - [ ] `styles.css` — plugin styles
- [ ] `README.md` with clear installation and usage instructions
- [ ] `versions.json` mapping every released version to its minimum Obsidian version
- [ ] Valid `manifest.json` with all required fields
- [ ] `id` in `manifest.json` matches what's registered in `community-plugins.json` (only relevant for the very first submission — this plugin is already listed, so this applies to `community-plugins.json` diffs only if the `id` ever needs to change, which it shouldn't)
- [ ] Git tag matching the version in `manifest.json` — **no `v` prefix** (see `.claude/commands/release.md`)

## Repository Requirements

### Required Files in Root

1. **manifest.json** ✅
   ```json
   {
     "id": "conditional-properties",
     "name": "Conditional Properties",
     "version": "X.Y.Z",
     "minAppVersion": "1.5.0",
     "description": "Automate your frontmatter with smart IF/THEN rules. Set properties, modify titles, and keep your vault organized—automatically.",
     "author": "Diego Eis",
     "authorUrl": "https://diegoeis.com",
     "isDesktopOnly": false
   }
   ```

2. **versions.json** ✅ — format `"<plugin-version>": "<minimum-obsidian-version>"`, one entry per released version.

3. **README.md** ✅ — installation instructions, usage examples, configuration details (this repo's README already covers all of this; keep it in sync with any behavior change).

4. **LICENSE** ✅ — MIT, already present. Required for community trust and for the Obsidian directory listing.

## First-Time Submission Process

*(Not applicable if the plugin is already listed — skip to "Updating the Plugin" below. Kept here for reference / in case of a future re-submission.)*

### Step 1: Verify the release

1. Go to `https://github.com/diegoeis/obsidian-conditional-properties/releases/tag/<version>`
2. Confirm the release includes `main.js`, `manifest.json`, `styles.css` (the `release.yml` workflow attaches these automatically when a GitHub Release is published from a tag).
3. Verify the tag exists and has no `v` prefix: `git tag -l`

### Step 2: Fork `obsidian-releases`

```bash
git clone git@github.com:<your-fork>/obsidian-releases.git
cd obsidian-releases
```

### Step 3: Add the plugin to `community-plugins.json`

Add the entry **at the END of the array**, not alphabetically (per Obsidian's own contribution instructions):

```json
{
  "id": "conditional-properties",
  "name": "Conditional Properties",
  "author": "Diego Eis",
  "description": "Automate your frontmatter with smart IF/THEN rules. Set properties, modify titles, and keep your vault organized—automatically.",
  "repo": "diegoeis/obsidian-conditional-properties"
}
```

### Step 4: Commit and push

```bash
git add community-plugins.json
git commit -m "Add Conditional Properties plugin"
git push origin main
```

### Step 5: Open the pull request

Follow the PR template from `obsidianmd/obsidian-releases`, and check every box only once it's actually true (public repo, valid `manifest.json`/`versions.json`, README with install/usage, initial release with all three files, `id` matches repo, no policy violations).

### Step 6: Wait for review

Typically 1–2 weeks for initial review; expect requested changes.

### Step 7: Address feedback

Make changes in this repo, cut a new release if code changed, then update the `obsidian-releases` PR if `community-plugins.json` itself needs a change.

## Common Review Points

The Obsidian review bot (`eslint-plugin-obsidianmd`) and the human reviewers check for:

1. **Security**
   - No hardcoded secrets (this plugin has none — no network calls at all)
   - No `eval()` / dynamic code execution
   - No `innerHTML`
   - File paths derived from user/placeholder input are sanitized against vault escape

2. **Code Quality**
   - No `console.log()` in shipped code (`console.warn`/`console.error` are fine)
   - Proper error handling
   - Sentence-case UI strings (`Setting.setName()`, dropdown option labels, button text)

3. **User Experience**
   - Clear error messages via `Notice`
   - No blocking operations during a scan

4. **Documentation**
   - Clear README with install/usage/configuration
   - Any network use, telemetry, or account requirement disclosed in the README — not applicable here since this plugin has none, per [`OBSIDIAN_DEVELOPMENT_POLICIES.md`](OBSIDIAN_DEVELOPMENT_POLICIES.md)

## After Approval

Once listed, the plugin appears in the Community Plugins browser and updates automatically for users when a new GitHub Release is published with a matching `manifest.json`/`versions.json` bump.

## Updating the Plugin (the common case for this repo)

For every release:

1. Bump `version` in `manifest.json`
2. Add the corresponding entry to `versions.json`
3. Update `CHANGELOG.md` (and `.claude/docs/features-info.md` / relevant PRD-FRD if behavior changed)
4. Tag `X.Y.Z` (no `v` prefix) and push
5. Publish a GitHub Release from the tag — `release.yml` builds and attaches `manifest.json`, `main.js`, `versions.json` automatically
6. No further action needed in `obsidian-releases` — it already tracks this repo via `community-plugins.json`; users get the update automatically

## Useful Links

- Plugin Guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Developer Policies: https://docs.obsidian.md/Developer+policies
- Plugin Review checklist: https://github.com/obsidianmd/obsidian-releases/blob/master/plugin-review.md
- Community Plugins list: https://github.com/obsidianmd/obsidian-releases/blob/master/community-plugins.json
- ESLint plugin: https://github.com/obsidianmd/eslint-plugin

## Support

- Obsidian Discord: https://discord.gg/obsidianmd
- Forum: https://forum.obsidian.md/
- GitHub Discussions: https://github.com/obsidianmd/obsidian-releases/discussions
