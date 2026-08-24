---
title: Backup & Restore
nav_order: 9
---

# Backup & restore settings

Settings → Conditional Properties → **Backup and restore**.

## Export settings

Writes `conditional-properties-settings-YYYY-MM-DD.json` to your **vault's root folder** (not your OS's Downloads folder) and shows a `Notice` confirming the path. This works the same way on desktop and mobile — it writes through Obsidian's own vault API rather than triggering a browser download dialog, which isn't reliable in Obsidian Mobile's WebView.

## Import settings

Opens a file picker; pick any exported JSON file to restore your rules and scan settings. Useful for moving your rule set to another vault, or restoring after experimenting with changes.
