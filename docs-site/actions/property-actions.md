---
title: Property Actions
parent: Actions (THEN)
nav_order: 1
---

# Property actions

## Add value

Adds a value to a property without duplicating it. Converts a scalar to an array when needed.

```yaml
THEN ADD tags: important
```

## Remove value

Removes a specific value from a property or array.

```yaml
THEN REMOVE tags: active, wip
```

## Overwrite property

Replaces the entire value.

```yaml
THEN OVERWRITE property: status = "archived"
```

{: .important }
**Unlike Add/Remove, Overwrite does not split on commas.** `THEN OVERWRITE property: tags = "a, b, c"` writes the literal string `"a, b, c"` as a single value, not the array `[a, b, c]`. The settings UI's "(use commas; …)" hint on the value field applies to Add and Remove, not to Overwrite — if you need a multi-value array, use **Add** (on an empty or non-existent property, it creates the array for you) instead of Overwrite.

## Delete property

Removes the property from the note entirely.

```yaml
THEN DELETE PROPERTY: legacy_data
```

## Rename property

Copies a property's value to a new name and removes the old one.

```yaml
THEN RENAME property: old_name -> new_name
```

{: .note }
If a property already exists under the target name, the rename is silently skipped — it never overwrites an existing property. The **new name field does not support placeholders** (unlike every other property action's value field) — it's used exactly as typed.

## Typed property awareness

Writing to a `checkbox` / `date` / `datetime` property stores the real YAML type, so Obsidian's native widgets render correctly instead of showing plain text.

```yaml
THEN OVERWRITE property: completed = "true"
```
Result on disk: `completed: true` (boolean) — renders as a checked checkbox, not text.

For these scalar types, `ADD` behaves like `OVERWRITE` — you can't have a checkbox holding `[true, false]`. See [Typed Properties](/typed-properties) for the full parsing rules, including how date strings get normalized.

## Placeholders in values

Any property action's value can reference dates, times, the filename, another property, or a regex capture — see [Placeholders](/placeholders).

```yaml
THEN ADD property excerpt: "{{g_excerpt}}"
```
