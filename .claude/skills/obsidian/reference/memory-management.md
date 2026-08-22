# Memory Management & Lifecycle

Proper memory management is critical in Obsidian plugins to prevent memory leaks and ensure smooth performance.

*Repo note: this repo's periodic vault scan is registered via `registerInterval()` in `onload()` (with a hard 5-minute floor — never bypass it), and the settings tab observes scan progress through an `onScanStateChange` pub/sub callback instead of holding a view reference, which is the pattern the "don't store view references" rule below is getting at.*

## Use registerEvent() and addCommand() for Cleanup
Rule: Official guidelines

✅ **CORRECT**:
```typescript
async onload() {
  // These are automatically cleaned up on unload
  this.registerEvent(
    this.app.workspace.on('file-open', (file) => {
      // Handle file open
    })
  );

  this.addCommand({
    id: 'my-command',
    name: 'My command',
    callback: () => { }
  });

  // For DOM events, use registerDomEvent
  this.registerDomEvent(document, 'click', (evt) => {
    // Handle click
  });

  // For intervals, use registerInterval
  this.registerInterval(
    window.setInterval(() => {
      // Do something periodically
    }, 5000)
  );
}

onunload() {
  // No manual cleanup needed!
  // Obsidian handles it automatically
}
```

Rationale: Use `registerEvent()`, `addCommand()`, `registerDomEvent()`, and `registerInterval()` for automatic cleanup when the plugin unloads. This prevents memory leaks.

---

## Don't Store View References in Plugin
Rule: `obsidianmd/no-view-references-in-plugin`

❌ **INCORRECT**:
```typescript
this.registerView(VIEW_TYPE, (leaf) => {
  this.view = new MyCustomView(leaf);  // Memory leak!
  return this.view;
});
```

✅ **CORRECT**:
```typescript
this.registerView(VIEW_TYPE, (leaf) => {
  return new MyCustomView(leaf);  // Create and return directly
});
```

Rationale: Storing view instances as plugin properties prevents proper cleanup and causes memory leaks.

---

## Don't Use Plugin as Component
Rule: `obsidianmd/no-plugin-as-component`

❌ **INCORRECT**:
```typescript
// Passing plugin instance
MarkdownRenderer.render(app, markdown, el, sourcePath, this);

// Inline new Component()
MarkdownRenderer.render(app, markdown, el, sourcePath, new Component());
```

✅ **CORRECT**:
```typescript
const component = new Component();
MarkdownRenderer.render(app, markdown, el, sourcePath, component);
// Later: component.unload() when done
```

Rationale: Plugin lifecycle is too long, causing memory leaks. Components must be stored to call `unload()`.

---

## Don't Detach Leaves in onunload
Rule: `obsidianmd/detach-leaves` (auto-fixable)

❌ **INCORRECT**:
```typescript
onunload() {
  this.app.workspace.detachLeavesOfType(VIEW_TYPE);
}
```

✅ **CORRECT**:
```typescript
onunload() {
  // Let Obsidian handle leaf cleanup automatically
}
```

Rationale: Obsidian handles leaf cleanup automatically. Manual detachment can cause issues.

---

## Use getActiveLeavesOfType() Instead of Storing Views
Rule: Official guidelines (relates to no-view-references-in-plugin)

❌ **INCORRECT**:
```typescript
// Don't store view references
this.customViews = [];
```

✅ **CORRECT**:
```typescript
// Get views when needed
const views = this.app.workspace.getLeavesOfType(VIEW_TYPE)
  .map(leaf => leaf.view as MyCustomView);
```

Rationale: Don't store references to custom views. Use `getLeavesOfType()` or `getActiveLeavesOfType()` to access them when needed.
