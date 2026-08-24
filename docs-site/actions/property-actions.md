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
