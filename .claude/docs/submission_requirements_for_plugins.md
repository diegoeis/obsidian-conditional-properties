# Submission requirements for plugins

Mirror of https://docs.obsidian.md/community-directory/submission-requirements-for-plugins — check the live page if this file looks stale.

This page extends the [Developer policies](https://docs.obsidian.md/community-directory/developer-policies) (mirrored at [`OBSIDIAN_DEVELOPMENT_POLICIES.md`](OBSIDIAN_DEVELOPMENT_POLICIES.md)) with plugin-specific requirements that all plugins must follow to be published.

## Only use fundingUrl to link to services for financial support

Use [fundingUrl](https://docs.obsidian.md/Reference/Manifest#fundingUrl) if you accept financial support for your plugin, using services like Buy Me A Coffee or GitHub Sponsors.

If you don't accept donations, remove `fundingUrl` from your manifest.

## Set an appropriate minAppVersion

The `minAppVersion` in the [Manifest](https://docs.obsidian.md/Reference/Manifest) should be set to the minimum required version of the Obsidian app that your plugin is compatible with.
If you don't know what an appropriate version number is, use the latest stable build number.

## Keep plugin descriptions short and simple

Good plugin descriptions help users understand your plugin quickly and succinctly. Good descriptions often start with an action statement such as:

- "Translate selected text into..."
- "Generate notes automatically from..."
- "Import notes from..."
- "Sync highlights and annotations from..."
- "Open links in..."

Avoid starting your description with "This is a plugin", because it'll be obvious to users in the context of the Community Plugins directory.

Your description should:

- Follow the [Obsidian style guide](https://help.obsidian.md/Contributing+to+Obsidian/Style+guide).
- Have 250 characters maximum.
- End with a period `.`.
- Avoid using emoji or special characters.
- Use correct capitalization for acronyms, proper nouns and trademarks such as "Obsidian", "Markdown", "PDF". If you are not sure how to capitalize a term, refer to its website or Wikipedia description.

## Node.js and Electron APIs are only allowed on desktop

The Node.js and Electron APIs are only available in the desktop version of Obsidian. For example, Node.js packages like `fs`, `crypto`, and `os`, are only available on desktop.

If your plugin uses any of these APIs, you **must** set `isDesktopOnly` to `true` in the `manifest.json`.

> [!tip] Tip
> Many Node.js features have Web API alternatives:
>
> - [`SubtleCrypto`](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto) instead of [`crypto`](https://nodejs.org/api/crypto.html).
> - `navigator.clipboard.readText()` and `navigator.clipboard.writeText()` to access clipboard contents.

## Don't include the plugin ID in the command ID

Obsidian automatically prefixes command IDs with your plugin ID.
You don't need to include the plugin ID yourself.

## Remove all the sample code

The sample plugin includes examples how to do many of the most common things a plugin requires.
It's only there to get you started, sample code should be removed from your plugin before submission.

---

## How this applies to Conditional Properties

- **`fundingUrl`**: not present in `manifest.json` — correct, since this plugin doesn't accept donations. Don't add it unless that changes.
- **`minAppVersion`**: `1.5.0` in `manifest.json`, matching `versions.json`. Bump only when a change actually requires a newer Obsidian API.
- **Description**: `manifest.json`'s description — "Automate your frontmatter with smart IF/THEN rules. Set properties, modify titles, and keep your vault organized—automatically." — starts with an action statement, ends with a period, no emoji. Keep it under 250 characters on every edit.
- **isDesktopOnly**: `false` in `manifest.json`. This plugin uses no Node.js/Electron-only API (no `fs`, no `crypto`, no `os`) — only the Obsidian Vault/FileManager/metadataCache APIs, which work identically on mobile. Keep it `false` unless a future feature genuinely needs a desktop-only API; if that happens, flip this to `true` in the same change.
- **Command IDs**: already correct — `run-now`, `stop-scan`, `run-current-file` have no `conditional-properties-` prefix (Obsidian namespaces them automatically).
- **Sample code**: none present — there's no `MyPlugin`/`SampleSettingTab` leftover from the starter template, since this repo was never scaffolded from it.
