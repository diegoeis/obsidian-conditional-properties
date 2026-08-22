# Accessibility Rules (MANDATORY)

Generic, portable across any Obsidian plugin repo. These are **not optional** — treat every item as a release blocker, same weight as the validation-bot rules in [`submission-naming.md`](submission-naming.md).

Full text: [`.claude/docs/obsidian_plugin_guidelines.md`](../docs/obsidian_plugin_guidelines.md) (mirror of the [official plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)).

## Rules

1. **All interactive elements must be keyboard accessible** — tabbable, with Enter/Space support for activation.
2. **ARIA labels on every icon-only button.**
   ```javascript
   // ✅ CORRECT
   button.setAttribute('aria-label', 'Add rule');

   // ❌ WRONG — unreadable by screen readers
   button.setIcon('plus');
   ```
3. **Clear focus indicators via `:focus-visible`.**
   ```css
   button:focus-visible {
     outline: 2px solid var(--interactive-accent);
     outline-offset: 2px;
   }
   ```
4. **Minimum touch target size 44×44px** for anything tappable.
5. **Manage focus properly in modals** — trap focus while open, restore it on close.
6. **Test with keyboard-only navigation** before considering a UI change done.

## This repo (Conditional Properties)

The settings tab's rule rows and icon buttons (add/remove condition, add/remove action) must carry `aria-label` and stay keyboard-operable. Verify with `./scripts/sync.sh` + manual Tab/Enter navigation, not just a mouse click-through.
