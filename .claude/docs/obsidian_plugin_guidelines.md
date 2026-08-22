# Plugin guidelines

Mirror of https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines — check the live page if this file looks stale.

This page lists common review comments plugin authors get when submitting their plugin.

While the guidelines on this page are recommendations, depending on their severity, the Obsidian team may still require you to address any violations.

> [!important] Policies for plugin developers
> Make sure that you've read the [Developer policies](https://docs.obsidian.md/community-directory/developer-policies) (mirrored at [`OBSIDIAN_DEVELOPMENT_POLICIES.md`](OBSIDIAN_DEVELOPMENT_POLICIES.md)) as well as the [Submission requirements for plugins](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins) (mirrored at [`submission_requirements_for_plugins.md`](submission_requirements_for_plugins.md)).

## General

### Avoid using global app instance

Avoid using the global app object, `app` (or `window.app`). Instead, use the reference provided by your plugin instance, `this.app`.

The global app object is intended for debugging purposes and might be removed in the future.

### Avoid unnecessary logging to console

Please avoid unnecessary logging.
In its default configuration, the developer console should only show error messages, debug messages should not be shown.

### Consider organizing your code base using folders

If your plugin uses more than one `.ts` file, consider organizing them into folders to make it easier to review and maintain.

### Rename placeholder class names

The sample plugin contains placeholder names for common classes, such as `MyPlugin`, `MyPluginSettings`, and `SampleSettingTab`. Rename these to reflect the name of your plugin.

## Mobile

### Node and Electron APIs

The Node.js API, and the Electron API aren't available on mobile devices. Any calls to these libraries made by your plugin or its dependencies can cause your plugin to crash.

### Lookbehind in regular expressions

Lookbehind in regular expressions is only supported on iOS 16.4 and above, and some iPhone and iPad users may still use earlier versions. To implement a fallback for iOS users, either refer to [Platform-specific features](https://docs.obsidian.md/Plugins/Getting+started/Mobile+development#Platform-specific%20features), or use a JavaScript library to detect specific browser versions.

Refer to [Can I Use](https://caniuse.com/js-regexp-lookbehind) for more information and exact version statistics. Look for "Safari on iOS".

## UI text

This section lists guidelines for formatting text in the user interface, such as settings, commands, and buttons.

For more information on writing and formatting text for Obsidian, refer to the [Style guide](https://help.obsidian.md/Contributing+to+Obsidian/Style+guide).

### Only use headings under settings if you have more than one section

Avoid adding a top-level heading in the settings tab, such as "General", "Settings", or the name of your plugin.

If you have more than one section under settings, and one contains general settings, keep them at the top without adding a heading.

### Avoid "settings" in settings headings

In the settings tab, you can add headings to organize settings. Avoid including the word "settings" in these headings, since everything under the settings tab is already settings — repeating it for every heading becomes redundant.

- Prefer "Advanced" over "Advanced settings".
- Prefer "Templates" over "Settings for templates".

### Use sentence case in UI

Any text in UI elements should use [sentence case](https://en.wiktionary.org/wiki/sentence_case) instead of [title case](https://en.wikipedia.org/wiki/Title_case) — only the first word in a sentence, and proper nouns, should be capitalized.

- Prefer "Template folder location" over "Template Folder Location".
- Prefer "Create new note" over "Create New Note".

### Use setHeading instead of a `<h1>`, `<h2>`

Using the heading elements from HTML results in inconsistent styling between different plugins. Instead, use:

```ts
new Setting(containerEl).setName('your heading title').setHeading();
```

## Security

### Avoid innerHTML, outerHTML and insertAdjacentHTML

Building DOM elements from user-defined input using `innerHTML`, `outerHTML` and `insertAdjacentHTML` can pose a security risk.

The following example builds a DOM element using a string that contains user input, `${name}`. `name` can contain other DOM elements, such as `<script>alert()</script>`, and can allow a potential attacker to execute arbitrary code on the user's computer:

```ts
function showName(name: string) {
  let containerElement = document.querySelector('.my-container');
  // DON'T DO THIS
  containerElement.innerHTML = `<div class="my-class"><b>Your name is: </b>${name}</div>`;
}
```

Instead, use the DOM API or the Obsidian helper functions, such as `createEl()`, `createDiv()` and `createSpan()`, to build the DOM element programmatically. For more information, refer to [HTML elements](https://docs.obsidian.md/Plugins/User+interface/HTML+elements).

To clean up an HTML element's contents, use `el.empty();`.

## Resource management

### Clean up resources when plugin unloads

Any resources created by the plugin, such as event listeners, must be destroyed or released when the plugin unloads.

When possible, use methods like [registerEvent()](https://docs.obsidian.md/Reference/TypeScript+API/Component/registerEvent) or [addCommand()](https://docs.obsidian.md/Reference/TypeScript+API/Plugin/addCommand) to automatically clean up resources when the plugin unloads.

```ts
export default class MyPlugin extends Plugin {
  onload() {
    this.registerEvent(this.app.vault.on('create', this.onCreate));
  }

  onCreate: (file: TAbstractFile) => {
    // ...
  }
}
```

> [!note] Note
> You don't need to clean up resources that are guaranteed to be removed when your plugin unloads. For example, if you register a `mouseenter` listener on a DOM element, the event listener will be garbage-collected when the element goes out of scope.

### Don't detach leaves in onunload

When the user updates your plugin, any open leaves will be reinitialized at their original position, regardless of where the user had moved them.

## Commands

### Avoid setting a default hotkey for commands

Setting a default hotkey may lead to conflicts between plugins and may override hotkeys that the user has already configured.

It's also difficult to choose a default hotkey that is available on all operating systems.

### Use the appropriate callback type for commands

When you add a command in your plugin, use the appropriate callback type.

- Use `callback` if the command runs unconditionally.
- Use `checkCallback` if the command only runs under certain conditions.

If the command requires an open and active Markdown editor, use `editorCallback`, or the corresponding `editorCheckCallback`.

## Workspace

### Avoid accessing workspace.activeLeaf directly

If you want to access the active view, use [getActiveViewOfType()](https://docs.obsidian.md/Reference/TypeScript+API/Workspace/getActiveViewOfType) instead:

```ts
const view = this.app.workspace.getActiveViewOfType(MarkdownView);

// getActiveViewOfType will return null if the active view is null, or if it's not a MarkdownView.
if (view) {
  // ...
}
```

If you want to access the editor in the active note, use `activeEditor` instead:

```ts
const editor = this.app.workspace.activeEditor?.editor;

if (editor) {
    // ...
}
```

### Avoid managing references to custom views

Managing references to custom views can cause memory leaks or unintended consequences.

**Don't** do this:

```ts
this.registerView(MY_VIEW_TYPE, () => this.view = new MyCustomView());
```

Do this instead:

```ts
this.registerView(MY_VIEW_TYPE, () => new MyCustomView());
```

To access the view from your plugin, use `Workspace.getActiveLeavesOfType()`:

```ts
for (let leaf of app.workspace.getActiveLeavesOfType(MY_VIEW_TYPE)) {
  let view = leaf.view;
  if (view instanceof MyCustomView) {
    // ...
  }
}
```

## Vault

### Prefer the Editor API instead of Vault.modify to the active file

If you want to edit an active note, use the [Editor](https://docs.obsidian.md/Plugins/Editor/Editor) interface instead of [Vault.modify()](https://docs.obsidian.md/Reference/TypeScript+API/Vault/modify).

Editor maintains information about the active note, such as cursor position, selection, and folded content. When you use `Vault.modify()` to edit the note, all that information is lost, which leads to a poor experience for the user.

Editor is also more efficient when making small changes to parts of the note.

### Prefer Vault.process instead of Vault.modify to modify a file in the background

If you want to edit a note that is not currently opened, use [Vault.process](https://docs.obsidian.md/Reference/TypeScript+API/Vault/process) instead of [Vault.modify](https://docs.obsidian.md/Reference/TypeScript+API/Vault/modify).

The `process` function modifies the file atomically, which means your plugin won't run into conflicts with other plugins modifying the same file.

### Prefer FileManager.processFrontMatter to modify frontmatter of a note

Instead of extracting the frontmatter of a note and parsing/modifying the YAML manually, use [FileManager.processFrontMatter](https://docs.obsidian.md/Reference/TypeScript+API/FileManager/processFrontMatter).

`processFrontMatter` runs atomically, so modifying the file won't conflict with other plugins editing the same file. It also ensures a consistent layout of the YAML produced.

### Prefer the Vault API over the Adapter API

Obsidian exposes two APIs for file operations: the Vault API (`app.vault`) and the Adapter API (`app.vault.adapter`).

While the file operations in the Adapter API are often more familiar to many developers, the Vault API has two main advantages:

- **Performance**: the Vault API has a caching layer that can speed up file reads when the file is already known to Obsidian.
- **Safety**: the Vault API performs file operations serially to avoid race conditions, for example when reading a file that is being written to at the same time.

### Avoid iterating all files to find a file by its path

This is inefficient, especially for large vaults. Use [Vault.getFileByPath](https://docs.obsidian.md/Reference/TypeScript+API/Vault/getFileByPath), [Vault.getFolderByPath](https://docs.obsidian.md/Reference/TypeScript+API/Vault/getFolderByPath) or [Vault.getAbstractFileByPath](https://docs.obsidian.md/Reference/TypeScript+API/Vault/getAbstractFileByPath) instead.

**Don't** do this:

```ts
this.app.vault.getFiles().find(file => file.path === filePath);
```

Do this instead:

```ts
const filePath = 'folder/file.md';
// if you want to get a file
const file = this.app.vault.getFileByPath(filePath);
```

```ts
const folderPath = 'folder';
// or if you want to get a folder
const folder = this.app.vault.getFolderByPath(folderPath);
```

If you aren't sure if the path provided is for a folder or a file, use:

```ts
const abstractFile = this.app.vault.getAbstractFileByPath(filePath);

if (file instanceof TFile) {
    // it's a file
}
if (file instanceof TFolder) {
    // it's a folder
}
```

### Use normalizePath() to clean up user-defined paths

Use [normalizePath()](https://docs.obsidian.md/Reference/TypeScript+API/normalizePath) whenever you accept user-defined paths to files or folders in the vault, or when you construct your own paths in the plugin code.

`normalizePath()` takes a path and scrubs it to be safe for the file system and for cross-platform use. This function:

- Cleans up the use of forward and backward slashes, such as replacing 1 or more of `\` or `/` with a single `/`.
- Removes leading and trailing forward and backward slashes.
- Replaces any non-breaking spaces, ` `, with a regular space.
- Runs the path through [String.prototype.normalize](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize).

```ts
import { normalizePath } from 'obsidian';
const pathToPlugin = normalizePath('//my-folder\\file');
// pathToPlugin contains "my-folder/file" not "//my-folder\\"
```

## Editor

### Change or reconfigure editor extensions

If you want to change or reconfigure an [editor extension](https://docs.obsidian.md/Plugins/Editor/Editor+extensions) after registering it with [registerEditorExtension()](https://docs.obsidian.md/Reference/TypeScript+API/Plugin/registerEditorExtension), use [updateOptions()](https://docs.obsidian.md/Reference/TypeScript+API/Workspace/updateOptions) to update all editors.

```ts
class MyPlugin extends Plugin {
  private editorExtension: Extension[] = [];

  onload() {
    //...

    this.registerEditorExtension(this.editorExtension);
  }

  updateEditorExtension() {
    // Empty the array while keeping the same reference
    // (Don't create a new array here)
    this.editorExtension.length = 0;

    // Create new editor extension
    let myNewExtension = this.createEditorExtension();
    // Add it to the array
    this.editorExtension.push(myNewExtension);

    // Flush the changes to all editors
    this.app.workspace.updateOptions();
  }
}
```

## Styling

### No hardcoded styling

**Don't** do this:

```ts
const el = containerEl.createDiv();
el.style.color = 'white';
el.style.backgroundColor = 'red';
```

To make it easy for users to modify the styling of your plugin, use CSS classes — hardcoding styling in the plugin code makes it impossible to modify with themes and snippets.

**Do** this instead:

```ts
const el = containerEl.createDiv({cls: 'warning-container'});
```

In the plugin's CSS, add:

```css
.warning-container {
    color: var(--text-normal);
    background-color: var(--background-modifier-error);
}
```

To make the styling of your plugin consistent with Obsidian and other plugins, use the [CSS variables](https://docs.obsidian.md/Reference/CSS+variables/CSS+variables) provided by Obsidian. If there's no variable available that fits your case, you can create your own.

## TypeScript

### Prefer const and let over var

For more information, refer to [4 Reasons Why var is Considered Obsolete in Modern JavaScript](https://javascript.plainenglish.io/4-reasons-why-var-is-considered-obsolete-in-modern-javascript-a30296b5f08f).

### Prefer async/await over Promise

Recent versions of JavaScript and TypeScript support the `async` and `await` keywords to run code asynchronously, which allows for more readable code than chaining Promises.

**Don't** do this:

```ts
function test(): Promise<string | null> {
  return requestUrl('https://example.com')
    .then(res => res.text)
    .catch(e => {
      console.log(e);
      return null;
    });
}
```

Do this instead:

```ts
async function asyncTest(): Promise<string | null> {
  try {
    let res = await requestUrl('https://example.com');
    let text = await res.text;
    return text;
  }
  catch (e) {
    console.log(e);
    return null;
  }
}
```

---

## How this applies to Conditional Properties

This repo is plain JS (no `.ts` files, no build), so a few sections above translate rather than apply literally:

- **Global app instance**: `main.js` already uses `this.app` throughout — never the bare `app` global. Keep it that way.
- **Console logging**: already scoped to `console.error()` on real failure paths only — no stray `console.log()`.
- **Organizing code in folders**: not applicable — this repo is intentionally a single `main.js` file by design (see root `CLAUDE.md`), not a multi-file `.ts` build.
- **Placeholder class names**: none present — `ConditionalPropertiesPlugin` / `ConditionalPropertiesSettingTab` are the real names, not leftovers from the sample plugin.
- **Node/Electron APIs, mobile**: none used. See [`submission_requirements_for_plugins.md`](submission_requirements_for_plugins.md) for the `isDesktopOnly` status.
- **Lookbehind regex**: none of the regexes in `main.js` (H1 detection, YAML block detection, etc.) use lookbehind — keep new regexes free of `(?<=...)`/`(?<!...)` for iOS < 16.4 compatibility.
- **UI text**: settings tab has no top-level "Conditional Properties" heading, and "If:"/"Then:" section headers don't say "settings". A few dropdown labels ("Latest Created notes", "Latest Modified notes") still violate sentence case and should be fixed to "Latest created notes" / "Latest modified notes" — tracked as a follow-up, not fixed by this doc update alone.
- **setHeading()**: already used for the "Rules" section header — no raw `<h1>`/`<h2>`.
- **innerHTML/outerHTML**: none in `main.js` — DOM is built via `createEl`/`createDiv` and Obsidian's `Setting`/`ButtonComponent`/`DropdownComponent`.
- **Resource cleanup**: the scheduler interval goes through `registerInterval()`; the settings tab's scan-state subscriptions are torn down in `hide()` via `_teardownScanSubscriptions()`. `onunload()` is empty by design — nothing registered outside those helpers needs manual cleanup.
- **No custom views, no leaf detaching**: this plugin has no `ItemView`/custom leaves at all — not applicable.
- **Default hotkeys**: none of the three commands (`run-now`, `stop-scan`, `run-current-file`) set a `hotkeys` property — correct.
- **Command callback types**: all three commands use `checkCallback` (each has a real enable/disable condition — scan not already running, or an active file existing) — correct choice, not `callback`.
- **FileManager.processFrontMatter**: already the actual write path in `_writeFrontmatter()` — good, matches the guideline.
- **Vault.process**: used in `_updateNoteTitle()` for background title edits — matches the guideline; this plugin never edits the *currently open* file through the Editor API, since scans target arbitrary vault files, not necessarily the active one.
- **Vault API over Adapter API**: mostly followed — `app.vault.adapter.exists()`/`.read()`/`.write()` are used only for the one-time `data.json` migration backup (`_writeMigrationBackup()`), which is deliberately outside normal vault content and not a case `Vault.getFileByPath()` covers (it's a plugin-data-folder path, not a vault path).
- **Avoid iterating all files to find one by path**: `_getFilesToScan()` intentionally iterates `vault.getMarkdownFiles()` to build a scored/sorted subset (latest created/modified) — that's a real scan-scope feature, not a path lookup, so this guideline doesn't apply to it.
- **normalizePath()**: **not currently used** in `_sanitizeVaultFolderPath()` / `_sanitizeFilenameComponent()` (the "Note file" move/rename actions) — those hand-roll their own segment-stripping sanitization instead. Worth revisiting: `normalizePath()` plus the existing traversal-stripping logic together would be more robust than the traversal-stripping alone. Tracked as a follow-up, not changed by this doc update.
- **Editor extensions**: not used by this plugin — not applicable.
- **No hardcoded styling**: `styles.css` uses Obsidian CSS variables (`--background-modifier-border`, `--text-normal`, etc.) throughout, scoped under `#eis-cp-plugin` — matches the guideline.
- **const/let, async/await**: already followed throughout `main.js` — no `var`, no bare `.then()` chains in the rule-engine code.
