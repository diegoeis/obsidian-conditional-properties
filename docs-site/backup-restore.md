---
title: Backup & Restore
nav_order: 9
---

# Backup, restore & rule search

Settings → Conditional Properties → **Backup and restore**, and the search field right above your rule list.

## Export settings

Writes `conditional-properties-settings-YYYY-MM-DD.json` to your **vault's root folder** (not your OS's Downloads folder) and shows a `Notice` confirming the path. This works the same way on desktop and mobile — it writes through Obsidian's own vault API rather than triggering a browser download dialog, which isn't reliable in Obsidian Mobile's WebView.

The full path of the most recent export is also shown as **Latest export**, right under this section's description. On desktop that's the full OS filesystem path (e.g. `/Users/name/Vault/conditional-properties-settings-2026-08-29.json`); mobile has no real filesystem path to show, so it falls back to the vault-relative one. It stays there after reopening the settings tab or restarting Obsidian.

## Import settings

Opens a file picker; pick any exported JSON file to restore your rules and scan settings. Useful for moving your rule set to another vault, or restoring after experimenting with changes.

## Rule search

Right under the **Rules** heading, above the rule list: a dropdown (**Property** / **First level title** / **Note file**) plus a search field that filters the list live as you type, once you've typed at least 2 characters.

It searches whichever field that condition type stores its text in:

| Condition type | Searches |
|---|---|
| **Property** | The property name typed in the IF condition |
| **First level title** | The text typed in the IF condition |
| **Note file** | The text typed in the IF condition |

Matching is case-insensitive and a literal substring — a `/regex/`-mode condition value is matched as that literal text, slashes included, never interpreted as a pattern. A rule shows up if **any** of its IF conditions of the selected type matches, regardless of the rule's own Match (Any/All) setting.

```yaml
Search: Property → "people"
```
Shows only rules with a Property condition whose property name contains "people" — matches `people`, `peoples_list`, etc.

The search field is Obsidian's native search input, with its own built-in clear ("×") button. The filter resets every time you reopen the settings tab.
