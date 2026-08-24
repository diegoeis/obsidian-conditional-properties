---
title: Getting Started
nav_order: 2
---

# Getting Started

## Installation

### From Community Plugins

1. Settings → Community Plugins → Browse
2. Search "Conditional Properties"
3. Install and enable

### Manual installation

1. Copy the plugin folder to `.obsidian/plugins/obsidian-conditional-properties`
2. Settings → Community Plugins → Enable "Conditional Properties"

## Your first rule

Every rule has the same shape: an **IF** block (one or more conditions) and a **THEN** block (one or more actions). Let's build one that tags meeting notes.

1. Open Settings → Conditional Properties → **Add rule**.
2. Under **If**, leave the condition type as **Property**, set the property name to `type`, the operator to `exactly`, and the value to `meeting`.
3. Under **Then**, leave the action as **Property → Add value**, set the property name to `tags`, and the value to `work, important`.
4. Click **Run this rule** to test it against your configured scan scope, or **Run now** to run every rule in the vault.

```yaml
IF property: type = "meeting"
THEN ADD tags: work, important
```

That's it — any note with `type: meeting` in its frontmatter now gets `tags: [work, important]` added, without duplicating values on repeated runs.

## Running rules

- **Settings** → Conditional Properties → **Run now** (all rules, whole scan scope) or **Run this rule** (just one rule)
- **Command palette** → "Run conditional rules on vault" or "Run conditional rules on current file"
- **Scheduled** → set a scan interval (minimum 5 minutes) and the plugin runs automatically

See [Execution & Scheduling](/execution-scheduling) for scan scopes and the Stop button.

## Where to go from here

- [Examples](/examples) — a cookbook of rules, from simple to complex
- [Conditions (IF)](/conditions/) — everything a rule can check
- [Actions (THEN)](/actions/) — everything a rule can do
- [Placeholders](/placeholders) — dynamic values like `{{date}}` and `{{propertyName}}`
