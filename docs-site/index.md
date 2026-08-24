---
title: Home
layout: home
nav_order: 1
---

# Conditional Properties for Obsidian
{: .fs-9 }

Automate your frontmatter with smart IF/THEN rules. Set properties, modify titles, and keep your vault organized — automatically.
{: .fs-6 .fw-300 }

[Get started](/getting-started){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[View on GitHub](https://github.com/diegoeis/obsidian-conditional-properties){: .btn .fs-5 .mb-4 .mb-md-0 }

---

![Plugin Interface](https://i.imgur.com/d13fhzH.jpeg)

## Why use this plugin?

Stop manually updating properties across hundreds of notes. Define rules once, run everywhere. Useful for:

- Auto-tagging notes based on content
- Maintaining consistent metadata
- Bulk property updates
- Scheduled maintenance
- Targeted scope (latest created/modified notes, or a single file)

## Quick examples

**Auto-tag meetings:**
```yaml
IF    Property: type → exactly match → "meeting"
THEN  Property: tags → Add value → work, important
```

**Sort transcripts into a dated folder:**
```yaml
IF    Note file: Filename contains → "transcript"
THEN  Note file: Move file to → "transcripts/{{date}}"
```

**Date-stamp completed tasks:**
```yaml
IF    Property: status → exactly match → "done"
THEN  First level title: Add suffix → " - {{date:DD/MM/YYYY}}"
```

## Where to go next

| Section | What's there |
|---|---|
| [Getting Started](/getting-started) | Install the plugin and build your first rule |
| [Examples](/examples) | A cookbook of rules, from simple to complex |
| [Conditions (IF)](/conditions/) | Property, First level title, Note file, regex matching, multiple conditions |
| [Actions (THEN)](/actions/) | Property, First level title, Note file actions, multiple actions per rule |
| [Placeholders](/placeholders) | `{{date}}`, `{{time}}`, `{{title}}`, `{{propertyName}}`, `{{match}}` |
| [Typed Properties](/typed-properties) | Checkbox / date / datetime auto-coercion |
| [Execution & Scheduling](/execution-scheduling) | Run manually, scheduled scans, scan scopes |
| [Backup & Restore](/backup-restore) | Export/import your rules |
| [Help](/help) | Bug reports, feature requests |
| [Changelog](/changelog) | Version history |

## Safe & private

- Only modifies frontmatter — body content is preserved
- All processing happens locally
- No data leaves your device
