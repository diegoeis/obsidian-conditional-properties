---
title: Property
parent: Conditions (IF)
nav_order: 1
---
{% raw %}

# Property condition

Checks any frontmatter property's value.

```yaml
IF  Property: status → exactly match → "done"
```

The condition row is: **Property** type → property name field → operator dropdown → value field. All [six operators](/conditions/#six-comparison-operators) work on a Property condition:

```yaml
IF  Property: tags → does not contain → "draft"
IF  Property: reviewed → does not exist
IF  Property: excerpt → is empty
```

If the property holds a **list** (e.g. `tags: [a, b, c]`), **exactly match** / **contains** / **does not contain** test each item in the list — a match on any one item counts as a match for **exactly match**/**contains**, and **does not contain** requires none of the items to match.

{: .important }
**`exactly match` / `contains` / `does not contain` are case-sensitive.** `status → exactly match → "Done"` will not match a stored `status: done`. This is different from [Note file](/conditions/note-file) filename matching, which is case-insensitive by default.

{: .note }
**`is empty` on a missing property returns `false`, not `true`.** A property that doesn't exist at all is neither "empty" nor "not empty" as far as `is empty` is concerned — use `does not exist` to catch a missing property. `is empty` only returns `true` for a property that's present but holds an empty string or empty array.

## Regex matching

**exactly match**, **contains**, and **does not contain** accept a `/pattern/flags` value instead of a literal string. See [Regex Matching](/conditions/regex-matching) for the full syntax and flags.

```yaml
IF  Property: title → contains → /\d{4}-\d{2}-\d{2}/
```

Regex on a **list** property (like `tags`) still matches against each item, but there's no single scalar to pull a capture from for [`{{match}}` in THEN](/actions/note-file-actions#match-in-then-beta) — capture groups are only exposed for a Property condition holding a single (non-list) value.

## Placeholders in the value

The value field accepts [placeholders](/placeholders) too, resolved against the file being checked before the comparison runs:

```yaml
IF  Property: dateDue → exactly match → "{{today}}"
```
Matches when `dateDue` holds today's date.

You can also compare one property against another — anything that isn't a reserved placeholder name is looked up as a frontmatter property:

```yaml
IF  Property: type → exactly match → "{{company}}"
```
Matches when the note's `type` property has the exact same value as its `company` property.

{: .note }
A `/regex/` value (see [Regex matching](#regex-matching) above) is never expanded for placeholders — `/{{today}}/` is treated as a literal regex pattern, not "today's date wrapped in a regex".

## Typed property awareness

When a property is registered as `checkbox`, `date`, or `datetime` in Obsidian's property types, your typed value is normalized before comparing — so you can write the IF condition however feels natural, and the plugin adapts to the stored format.

```yaml
IF  Property: created_at → exactly match → "08-08-2025"
```
Matches a note whose YAML stores `created_at: 2025-08-08` — the plugin parses `08-08-2025` using your vault's Daily Notes / Templates date format (or a few common fallbacks) before comparing.

For checkbox properties, `Property: done → exactly match → "true"` matches a note with `done: true` (boolean) regardless of how you typed `true` (case-insensitive). See [Typed Properties](/typed-properties) for the full parsing rules.

{% endraw %}
