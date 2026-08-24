---
title: Regex Matching
parent: Conditions (IF)
nav_order: 4
---

# Regular expression matching

Wrap the value of `exactly`, `contains`, or `notContains` in forward slashes to match with a regular expression instead of a literal string — the same `/pattern/flags` convention as [Obsidian's Web Clipper URL-trigger patterns](https://help.obsidian.md/web-clipper/triggers#Regular+expression+matching).

Works on [Property](/conditions/property), [First level title](/conditions/first-level-title), and [Note file](/conditions/note-file) (the three filename operators). It does **not** work on `Parent folder is` / `Parent folder is not`, which always stay literal path matching.

```yaml
IF First level title contains: /\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])/
```
Matches a title like "Nota da reunião 2026-08-22 com John Doe" — the plugin finds the date `2026-08-22` inside the text.

## Flags

Standard JS regex flags are supported as a suffix:

```yaml
/report/i        # case-insensitive
/^draft/m        # multiline
```

## Missing slashes

If the text you type looks like a regex but is missing its `/slashes/`, the settings UI shows a hint under the field so it's easy to catch before it silently gets treated as a literal string.

## Malformed patterns fail safe

A malformed pattern (or unknown flag) never crashes a scan: it's treated as "does not match", and you get a one-time `Notice` plus a `console.error` identifying the broken pattern — not one Notice per file.

{: .warning }
**Mobile note:** avoid regex lookbehind (`(?<=...)` / `(?<!...)`) if you sync your vault to iOS — it isn't supported on iOS versions before 16.4. Named capture groups (`(?<name>...)`, used by [`{{match:name}}`](/actions/note-file-actions#match-in-then-beta)) are unaffected; only *lookbehind* assertions are the risk.

## Reusing the match in THEN

Whatever your IF regex matched — the full text, a numbered group, or a named group — is available in THEN actions via `{{match}}`. See [`{{match}}` in THEN (Beta)](/actions/note-file-actions#match-in-then-beta).
