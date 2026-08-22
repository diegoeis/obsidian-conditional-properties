# Memory Management & Lifecycle Rules

Generic, portable across any Obsidian plugin repo.

Full text: [`.claude/docs/obsidian_plugin_guidelines.md`](../docs/obsidian_plugin_guidelines.md) → "Improper resource cleanup" section (mirror of the [official plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)).

## Rules

1. **Use `registerEvent()` / `registerInterval()` / `registerDomEvent()` / `addCommand()` for anything that needs cleanup** — these auto-unregister on `onunload()`.
   ```javascript
   // ✅ CORRECT
   this.registerEvent(this.app.vault.on('modify', this.handleFileChange));
   this.registerInterval(window.setInterval(() => this.doPeriodicWork(), 5 * 60 * 1000));

   // ❌ WRONG — leaks on unload, requires manual cleanup
   this.app.vault.on('modify', this.handleFileChange);
   window.setInterval(() => this.doPeriodicWork(), 5 * 60 * 1000);
   ```
2. **Don't hold long-lived view/UI-state references on the plugin class** beyond what's needed — a view can be closed/replaced independently of the plugin.
   ```javascript
   // ❌ WRONG
   class MyPlugin extends Plugin { view: MyView; }

   // ✅ CORRECT — look it up when needed, or use a pub/sub callback the
   // consumer subscribes to and unsubscribes from (e.g. a settings tab's hide())
   const view = this.app.workspace.getLeavesOfType('my-view')[0]?.view;
   ```
3. **`onunload()` only needs to clean up what the `register*()` helpers didn't already cover** — e.g. a raw `addEventListener` on `document` instead of `registerDomEvent()`. Don't detach leaves in `onunload()`.
4. **Don't pass the plugin instance as a `Component` to `MarkdownRenderer`** — use a dedicated component with its own lifecycle instead.

## This repo (Conditional Properties)

`onload()` registers the scheduler interval and both commands through `registerInterval`/`addCommand`; the settings tab unsubscribes from `onScanStateChange` in its own `hide()` (`_teardownScanSubscriptions()`). Keep new long-running work on the same pattern — see [`CLAUDE.md`](../../CLAUDE.md) → Architecture.
