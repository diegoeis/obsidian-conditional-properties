---
title: Property Actions
parent: Actions (THEN)
nav_order: 1
---

# Property actions

## Add value

Adds a value to a property without duplicating it. Converts a scalar to an array when needed.

```yaml
THEN  Property: tags → Add value → important
```

The action row is: **Property** type → property name field → action dropdown → value field.

## Remove value

Removes a specific value from a property or array.

```yaml
THEN  Property: tags → Remove value → active, wip
```

## Overwrite all values with

Replaces the entire value.

```yaml
THEN  Property: status → Overwrite all values with → "archived"
```

{: .important }
**Unlike Add/Remove, Overwrite all values with does not split on commas.** `Property: tags → Overwrite all values with → "a, b, c"` writes the literal string `"a, b, c"` as a single value, not the array `[a, b, c]`. The settings UI's "(use commas; …)" hint on the value field applies to Add value and Remove value, not to Overwrite all values with — if you need a multi-value array, use **Add value** (on an empty or non-existent property, it creates the array for you) instead of Overwrite.

## Delete property

Removes the property from the note entirely. No value field — the action dropdown alone tells the plugin what to do.

```yaml
THEN  Property: legacy_data → Delete property
```

## Rename property to

Copies a property's value to a new name and removes the old one.

```yaml
THEN  Property: old_name → Rename property to → new_name
```

{: .note }
If a property already exists under the target name, the rename is silently skipped — it never overwrites an existing property. The **new name field does not support placeholders** (unlike every other property action's value field) — it's used exactly as typed.

## Typed property awareness

Writing to a `checkbox` / `date` / `datetime` property stores the real YAML type, so Obsidian's native widgets render correctly instead of showing plain text.

```yaml
THEN  Property: completed → Overwrite all values with → "true"
```
Result on disk: `completed: true` (boolean) — renders as a checked checkbox, not text.

For these scalar types, **Add value** behaves like **Overwrite all values with** — you can't have a checkbox holding `[true, false]`. See [Typed Properties](/typed-properties) for the full parsing rules, including how date strings get normalized.

## Placeholders in values

Any property action's value can reference dates, times, the filename, another property, or a regex capture — see [Placeholders](/placeholders).

```yaml
THEN  Property: excerpt → Add value → "{{g_excerpt}}"
```
