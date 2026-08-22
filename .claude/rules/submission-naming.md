# Submission & Naming Rules

Generic, portable across any Obsidian plugin repo. Validation-bot enforced — a violation blocks the `obsidian-releases` PR outright, not a style nit.

Full text: [`.claude/docs/submission_requirements_for_plugins.md`](../docs/submission_requirements_for_plugins.md) (mirror of the [official submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins)).

## Rules

1. **Plugin ID** — lowercase + hyphens only, must NOT contain "obsidian", must NOT end with "plugin".
   - ✅ `my-plugin`, `note-refactor` · ❌ `obsidian-my-plugin`, `my-plugin-plugin`
2. **Plugin name** — must NOT contain "Obsidian", must NOT end with "Plugin", must NOT start with "Obsi" or end with "dian".
   - ✅ `Note Refactor` · ❌ `Obsidian Note Refactor`, `Note Refactor Plugin`
3. **Description** (`manifest.json`) — no "Obsidian", "This plugin", "This is", "A plugin"; action-statement start; ends with `.?!)`; ≤250 chars; no emoji.
   - ✅ `Automate frontmatter and note titles with IF/THEN rules.` · ❌ `This plugin automates Obsidian frontmatter with rules`
4. **No "command" in command names or IDs** — redundant, Obsidian's UI already groups by plugin.
5. **No plugin ID in command IDs** — Obsidian auto-namespaces every command by plugin ID already.
   - ✅ `{ id: 'run-now', name: 'Run rules on vault' }` · ❌ `{ id: 'my-plugin-run-now', ... }`
6. **No default hotkeys** — avoid conflicting with the user's own bindings.
7. **`isDesktopOnly`** — `true` the moment any Node.js/Electron-only API is used; `false` otherwise.
8. **`fundingUrl`** — only if the plugin actually accepts donations.
9. **Remove all sample/template code before shipping** — no `MyPlugin`, `SampleModal`, `SampleSettingTab`, example commands, or template comments left over from the starter template.

## This repo (Conditional Properties)

See the "How this applies to Conditional Properties" section at the bottom of [`obsidian_plugin_guidelines.md`](../docs/obsidian_plugin_guidelines.md) and [`submission_requirements_for_plugins.md`](../docs/submission_requirements_for_plugins.md) for the current, file-specific compliance state (plugin ID, manifest description, `isDesktopOnly`, etc).
