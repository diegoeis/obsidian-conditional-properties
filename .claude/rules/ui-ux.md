# UI/UX & Styling Rules

Generic, portable across any Obsidian plugin repo.

Full text: [`.claude/docs/obsidian_plugin_guidelines.md`](../docs/obsidian_plugin_guidelines.md) (mirror of the [official plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)) — see the UI and CSS sections for the canonical examples. Variable reference at the [CSS variables docs](https://docs.obsidian.md/Reference/CSS+variables/CSS+variables).

## UI/UX rules

1. **Sentence case for all UI text** — "Advanced settings", not "Advanced Settings".
2. **No "command" in command names/IDs** — see [`submission-naming.md`](submission-naming.md).
3. **No plugin ID in command IDs** — see [`submission-naming.md`](submission-naming.md).
4. **No default hotkeys**.
5. **`.setHeading()` for settings headings, never raw HTML.**
   ```javascript
   // ✅ CORRECT
   new Setting(containerEl).setHeading().setName('Rules');

   // ❌ WRONG
   containerEl.innerHTML = '<h2>Rules</h2>';
   ```
6. **No "settings" in a settings heading, no top-level plugin-name heading in the settings tab** — the tab is already scoped to the plugin.
7. **`checkCallback` (not plain `callback`)** for any command whose availability depends on state (e.g. "no file open").

## Styling rules

8. **Use Obsidian CSS variables, never hardcoded colors/sizes/spacing** — respects the user's theme and light/dark mode automatically.
   ```css
   /* ✅ CORRECT */
   .my-plugin-rule {
     background-color: var(--background-primary);
     color: var(--text-normal);
     border: 1px solid var(--background-modifier-border);
   }

   /* ❌ WRONG — ignores the active theme */
   .my-plugin-rule { background-color: #ffffff; color: #000000; }
   ```
9. **Scope every selector to a plugin-specific container** — never bare tag/utility selectors that could leak into core Obsidian or other plugins' UI.
   ```css
   /* ✅ CORRECT */
   #my-plugin-settings .rule-row { }

   /* ❌ WRONG */
   .rule-row { }
   ```
10. **All styles live in `styles.css`** — never assign styles via JavaScript, never create `<link>`/`<style>` elements at runtime.
11. **No manual theme-switching logic** — CSS variables already adapt; don't branch on light/dark in JS to pick colors.

## This repo (Conditional Properties)

Known outstanding violation to fix opportunistically (don't introduce new ones): "Latest Created notes" / "Latest Modified notes" in the settings dropdown should read "Latest created notes" / "Latest modified notes". All three registered commands (`run-now`, `run-current-file`, stop) already follow rules 2–4 and 7 — keep new commands on the same pattern.

All plugin styling lives in [`styles.css`](../../styles.css), scoped under the plugin's own settings container. Any new UI element must follow the same scoping.
