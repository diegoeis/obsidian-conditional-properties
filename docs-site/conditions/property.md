---
title: Property
parent: Conditions (IF)
nav_order: 1
---

# Property condition

Checks any frontmatter property's value.

```yaml
IF property: status exactly "done"
```

All [six operators](/conditions/#six-comparison-operators) work on a Property condition:

```yaml
IF property: tags notContains "draft"
IF property: reviewed notExists
IF property: excerpt isEmpty
```

If the property holds a **list** (e.g. `tags: [a, b, c]`), `exactly` / `contains` / `notContains` test each item in the list — a match on any one item counts as a match for `exactly`/`contains`, and `notContains` requires none of the items to match.

{: .important }
**`exactly` / `contains` / `notContains` are case-sensitive.** `status exactly "Done"` will not match a stored `status: done`. This is different from [Note file](/conditions/note-file) filename matching, which is case-insensitive by default.

{: .note }
**`isEmpty` on a missing property returns `false`, not `true`.** A property that doesn't exist at all is neither "empty" nor "not empty" as far as `isEmpty` is concerned — use `notExists` to catch a missing property. `isEmpty` only returns `true` for a property that's present but holds an empty string or empty array.

## Regex matching

`exactly`, `contains`, and `notContains` accept a `/pattern/flags` value instead of a literal string. See [Regex Matching](/conditions/regex-matching) for the full syntax and flags.

```yaml
IF property: title contains /\d{4}-\d{2}-\d{2}/
```

Regex on a **list** property (like `tags`) still matches against each item, but there's no single scalar to pull a capture from for [`{{match}}` in THEN](/actions/note-file-actions#match-in-then-beta) — capture groups are only exposed for a Property condition holding a single (non-list) value.

## Typed property awareness

When a property is registered as `checkbox`, `date`, or `datetime` in Obsidian's property types, your typed value is normalized before comparing — so you can write the IF condition however feels natural, and the plugin adapts to the stored format.

```yaml
IF property: created_at exactly "08-08-2025"
```
Matches a note whose YAML stores `created_at: 2025-08-08` — the plugin parses `08-08-2025` using your vault's Daily Notes / Templates date format (or a few common fallbacks) before comparing.

For checkbox properties, `IF property: done exactly "true"` matches a note with `done: true` (boolean) regardless of how you typed `true` (case-insensitive). See [Typed Properties](/typed-properties) for the full parsing rules.
