# Obsidian Plugin Development Rules

Generic quick-reference for developing **any** Obsidian plugin — not tied to a specific project. Drop this file into `.claude/rules/` in any Obsidian plugin repo and it applies as-is; project-specific rules belong in that repo's own `CLAUDE.md` / `.claude/rules.md`, not here.

These rules apply whether the plugin ships TypeScript with a build step or plain JS with none — where an example is shown in TypeScript syntax, apply the same underlying API/principle in JS; the syntax differs, the API contract doesn't.

## Critical Plugin Rules

### Submission & Naming Requirements (Validation Bot Enforced)

1. **Plugin ID Rules:**
   - Must NOT contain "obsidian" anywhere
   - Must NOT end with "plugin"
   - Must be lowercase with hyphens only
   - ✅ Good: `my-plugin`, `note-refactor`
   - ❌ Bad: `obsidian-my-plugin`, `my-plugin-plugin`

2. **Plugin Name Rules:**
   - Must NOT contain "Obsidian" anywhere
   - Must NOT end with "Plugin"
   - Must NOT start with "Obsi" or end with "dian"
   - ✅ Good: `Note Refactor`
   - ❌ Bad: `Obsidian Note Refactor`, `Note Refactor Plugin`

3. **Description Rules:**
   - Must NOT contain: "Obsidian", "This plugin", "This is", "A plugin"
   - Must end with proper punctuation (`.?!)`)
   - Must be clear and concise
   - ✅ Good: `Automate frontmatter and note titles with IF/THEN rules.`
   - ❌ Bad: `This plugin automates Obsidian frontmatter with rules`

### Memory Management & Lifecycle

4. **Use `registerEvent()` / `registerInterval()` for automatic cleanup**
   ```javascript
   // ✅ CORRECT - Auto cleanup on unload
   this.registerEvent(this.app.vault.on('modify', this.handleFileChange));
   this.registerInterval(window.setInterval(() => this.doPeriodicWork(), 5 * 60 * 1000));

   // ❌ WRONG - Requires manual cleanup, leaks on unload
   this.app.vault.on('modify', this.handleFileChange);
   window.setInterval(() => this.doPeriodicWork(), 5 * 60 * 1000);
   ```

5. **Don't hold long-lived view/UI-state references in the plugin class beyond what's needed**
   ```javascript
   // ❌ WRONG - Memory leak, view can be closed/replaced independently of the plugin
   class MyPlugin extends Plugin {
     view: MyView;
   }

   // ✅ CORRECT - Look it up when needed, or use a pub/sub callback the
   // consumer subscribes to and unsubscribes from (e.g. in a settings
   // tab's hide() method)
   const view = this.app.workspace.getLeavesOfType('my-view')[0]?.view;
   ```

6. **Clean up in `onunload()`**
   ```javascript
   onunload() {
     // registerInterval()/registerEvent()/registerDomEvent() already clean
     // themselves up automatically; only clear anything registered outside
     // those helpers (e.g. a raw addEventListener on `document`).
   }
   ```

### Type Safety

7. **Use `instanceof` instead of assuming a shape**
   ```javascript
   // ✅ CORRECT
   if (file instanceof TFile) {
     await this.app.vault.read(file);
   }

   // ❌ WRONG - no runtime guarantee this is actually a TFile
   await this.app.vault.read(file);
   ```

8. **In TypeScript, avoid `any`; in plain JS, validate defensively at runtime instead** — a JS-only plugin has no compiler to catch a wrong shape, so guard against `undefined`/wrong-`typeof` values before acting on them, especially anything coming from `loadData()` (which returns whatever was last saved, potentially from an older schema version).

### API Best Practices

9. **Use `requestUrl()` for network calls, never `fetch()`** — `requestUrl()` bypasses CORS and works consistently across desktop and mobile. If the plugin makes network calls at all, disclose which remote services are used and why in the README, per [Obsidian's developer policies](https://docs.obsidian.md/Developer+policies).

10. **Use the Editor API for edits to the active file**
    ```javascript
    // ✅ CORRECT - Preserves cursor position and undo history
    const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
    if (editor) {
      editor.replaceRange(text, from, to);
    }

    // ❌ WRONG - Loses cursor position, creates a jarring UX
    await this.app.vault.modify(file, newContent);
    ```

11. **Use `FileManager.processFrontMatter()` for frontmatter writes**
    ```javascript
    // ✅ CORRECT - handles missing frontmatter blocks and malformed YAML safely
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter[prop] = value;
    });

    // ❌ WRONG - manual YAML parsing/splicing is fragile and easy to get wrong
    ```

12. **Use `normalizePath()` for user-provided paths**
    ```javascript
    // ✅ CORRECT - Cross-platform (Windows vs. POSIX separators)
    const normalizedPath = normalizePath(userPath);

    // ❌ WRONG - breaks on Windows
    const path = userPath;
    ```

13. **Use the `Platform` API for OS/device detection**
    ```javascript
    // ✅ CORRECT
    if (Platform.isMobile) { }

    // ❌ WRONG
    if (navigator.userAgent.includes('Mobile')) { }
    ```

### UI/UX Standards

14. **Use sentence case for all UI text**
    - ✅ Good: "Advanced settings", "Scan scope"
    - ❌ Bad: "Advanced Settings", "Scan Scope"

15. **No "command" in command names or IDs**
    ```javascript
    // ✅ CORRECT
    { id: 'run-on-current-file', name: 'Run rules on current file' }

    // ❌ WRONG
    { id: 'run-current-file-command', name: 'Run rules on current file command' }
    ```

16. **No plugin ID in command IDs** (Obsidian auto-namespaces every command by plugin ID)
    ```javascript
    // ✅ CORRECT
    { id: 'run-now', name: 'Run rules on vault' }

    // ❌ WRONG
    { id: 'my-plugin-run-now', name: 'Run rules on vault' }
    ```

17. **No default hotkeys** (avoid conflicting with the user's own bindings)
    ```javascript
    // ✅ CORRECT
    this.addCommand({
      id: 'run-now',
      name: 'Run rules on vault',
      // No hotkeys property
    });
    ```

18. **Use `.setHeading()` for settings headings, never raw HTML**
    ```javascript
    // ✅ CORRECT
    new Setting(containerEl).setHeading().setName('Rules');

    // ❌ WRONG
    containerEl.innerHTML = '<h2>Rules</h2>';
    ```

### Styling Rules

19. **Use Obsidian CSS variables** (respects the user's theme, light/dark mode)
    ```css
    /* ✅ CORRECT */
    .my-plugin-rule {
      background-color: var(--background-primary);
      color: var(--text-normal);
      border: 1px solid var(--background-modifier-border);
    }

    /* ❌ WRONG - hardcoded colors ignore the active theme */
    .my-plugin-rule {
      background-color: #ffffff;
      color: #000000;
    }
    ```

20. **Scope CSS to a plugin-specific container** (never bare tag/utility selectors that could leak into the rest of Obsidian's UI)
    ```css
    /* ✅ CORRECT */
    #my-plugin-settings .rule-row { }

    /* ❌ WRONG - too generic, can clash with core Obsidian or other plugins */
    .rule-row { }
    ```

### Accessibility (MANDATORY)

21. **Make all interactive elements keyboard accessible**
    - All clickable elements must be tabbable
    - Implement proper keyboard navigation
    - Support Enter/Space for activation

22. **Provide ARIA labels for icon-only buttons**
    ```javascript
    // ✅ CORRECT
    button.setAttribute('aria-label', 'Add rule');

    // ❌ WRONG - no label, unreadable by screen readers
    button.setIcon('plus');
    ```

23. **Define clear focus indicators**
    ```css
    /* ✅ CORRECT */
    button:focus-visible {
      outline: 2px solid var(--interactive-accent);
      outline-offset: 2px;
    }
    ```

### Security & Compatibility

24. **Don't use `innerHTML` or `outerHTML`** (XSS risk, and disallowed by the review bot)
    ```javascript
    // ✅ CORRECT
    element.createEl('div', { text: userInput });

    // ❌ WRONG
    element.innerHTML = userInput;
    ```

25. **Avoid regex lookbehind** (unsupported on iOS < 16.4 — breaks the plugin on older mobile devices)
    ```javascript
    // ❌ WRONG
    /(?<=\w+)/

    // ✅ CORRECT - restructure the regex or match manually instead
    ```

26. **Store secrets in Obsidian's secret storage, never in `data.json` or `localStorage`** — if the plugin needs an API key, token, or password, use Obsidian's dedicated secrets API so it isn't stored in plain text alongside regular settings. A plugin with no secrets at all doesn't need this — just don't invent a place to store credentials outside the sanctioned API if that ever changes.

### Code Quality

27. **Remove all sample/template code before shipping**
    - No `MyPlugin`, `SampleModal`, `SampleSettingTab` left over from the starter template
    - No example commands or settings
    - No template comments

28. **No `console.log()` in shipped code** — `console.warn()`/`console.error()` only, and only on real error paths
    ```javascript
    // ✅ CORRECT
    console.error('MyPlugin: failed to apply rule', error);

    // ❌ WRONG
    console.log('Scanning vault...');
    ```

## Resources

- [Obsidian Plugin Docs](https://docs.obsidian.md/)
- [Obsidian API Docs](https://docs.obsidian.md/Reference/TypeScript+API/)
- [Obsidian Developer Policies](https://docs.obsidian.md/Developer+policies)
- [Obsidian Plugin Guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
- [eslint-plugin-obsidianmd](https://github.com/obsidianmd/eslint-plugin) — checks a plugin against the official guidelines automatically
- `.claude/skills/obsidian/SKILL.md` — comprehensive reference guide (this repo)
