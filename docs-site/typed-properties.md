---
title: Typed Properties
nav_order: 7
---

# Typed properties (checkbox / date / datetime)

Some Obsidian property types have native widgets — a checkmark for `checkbox`, a calendar for `date`, a calendar+clock for `datetime`. For the widget to render correctly, the YAML must store the value with the right type: boolean for checkbox, ISO date for date/datetime. Plain strings won't trigger the widgets, even if the property is registered with the right type.

The plugin detects when the target property is one of these types and converts the rule's value automatically, on both the [IF](/conditions/property#typed-property-awareness) and [THEN](/actions/property-actions#typed-property-awareness) sides. You can keep writing rules with plain text and the plugin handles the rest.

{: .note }
This coercion only applies to a **literal** IF value. In [regex mode](/conditions/regex-matching#typed-properties-bypass-regex), it's skipped — the property's raw stored value is tested directly against your pattern.

## Checkbox

```yaml
IF    Property: status → exactly match → "done"
THEN  Property: completed → Overwrite all values with → "true"
```
Result on disk: `completed: true` (boolean). Obsidian renders a checked checkbox.

Rules:
- `"true"` (any casing) → `true`
- Anything else (`"false"`, empty, `"sim"`, etc.) → `false`

## Date / datetime

```yaml
IF    Property: status → exactly match → "done"
THEN  Property: created_at → Overwrite all values with → "08-08-2025"
```
Result on disk: `created_at: 2025-08-08` (ISO date). Obsidian renders the date widget.

How the date parsing works:

1. If your input is already `YYYY-MM-DD`, it's stored as-is.
2. Otherwise, the plugin tries the Daily Notes core plugin's date format (if enabled), then the Templates core plugin's date format (if enabled), then a few common civilian formats (`DD-MM-YYYY`, `DD/MM/YYYY`, `YYYY/MM/DD`).
3. The first format that parses successfully wins — the value is converted to `YYYY-MM-DD` before being written.
4. If nothing parses, the input is written as-is and the property won't render in the date widget.

Datetime properties (`YYYY-MM-DDTHH:mm:ss`) are not parsed and are written exactly as typed. The Obsidian datetime widget renders them when the input is already in that ISO datetime form.

## Notes

- Applies to both **Add value** and **Overwrite all values with** — for these scalar types, **Add value** behaves like **Overwrite all values with** (you can't have a checkbox holding `[true, false]`).
- Properties without a registered type (or registered as `text`, `number`, `multitext`, `tags`, etc.) keep the original string-based behavior — nothing changes for those.
- The same type-aware coercion happens on the IF side, not just when writing THEN actions.
