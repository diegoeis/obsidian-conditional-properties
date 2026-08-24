---
title: Regex Matching
parent: Conditions (IF)
nav_order: 4
---

# Regular expression matching

Wrap the value of **exactly match**, **contains**, or **does not contain** in forward slashes to match with a regular expression instead of a literal string — the same `/pattern/flags` convention as [Obsidian's Web Clipper URL-trigger patterns](https://help.obsidian.md/web-clipper/triggers#Regular+expression+matching).

Works on [Property](/conditions/property), [First level title](/conditions/first-level-title), and [Note file](/conditions/note-file) (the three filename operators — `Filename contains`, `Filename not contains`, `Filename exactly match`). It does **not** work on `Parent folder is` / `Parent folder is not`, which always stay literal path matching.

```yaml
IF  First level title: contains → /\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])/
```
Matches a title like "Nota da reunião 2026-08-22 com John Doe" — the plugin finds the date `2026-08-22` inside the text.

## Flags

Standard JS regex flags are supported as a suffix:

```yaml
/report/i        # case-insensitive
/^draft/m        # multiline
```

{: .important }
**Regex mode is case-sensitive by default**, on every condition type — add the `i` flag yourself if you want case-insensitive matching. This is the opposite of literal (non-regex) matching on a [Note file](/conditions/note-file) filename condition, which is always case-insensitive. [Property](/conditions/property) and [First level title](/conditions/first-level-title) literal matching is case-sensitive either way, so only the Note file case actually flips behavior when you switch to a regex.

{: .important }
**`exactly match` and `contains` behave identically in regex mode.** Both simply test whether the pattern matches anywhere in the value (JavaScript's `RegExp.test()`) — `exactly match` does **not** implicitly anchor the pattern to the whole string. If you want a true full-string match, anchor it yourself with `^` and `$`: `/^\d{4}-\d{2}-\d{2}$/`. Only `does not contain` actually changes behavior in regex mode (it negates the test result).

## Missing slashes

If the text you type looks like a regex but is missing its `/slashes/`, the settings UI shows a hint under the field so it's easy to catch before it silently gets treated as a literal string.

## Malformed patterns fail safe

A malformed pattern (or unknown flag) never crashes a scan: it's treated as "does not match", and you get a one-time `Notice` plus a `console.error` identifying the broken pattern — not one Notice per file.

{: .warning }
**Mobile note:** avoid regex lookbehind (`(?<=...)` / `(?<!...)`) if you sync your vault to iOS — it isn't supported on iOS versions before 16.4. Named capture groups (`(?<name>...)`, used by [`{{match:name}}`](/actions/note-file-actions#match-in-then-beta)) are unaffected; only *lookbehind* assertions are the risk.

## Typed properties bypass regex

[Typed property coercion](/typed-properties) (normalizing a `checkbox`/`date`/`datetime` value before comparing) only applies to literal (non-regex) matching. In regex mode, the property's raw stored value is tested directly against your pattern — so a `date` property still stored as `2025-08-08` needs a pattern that matches that ISO format, not whatever format you'd otherwise type for a literal comparison.

## Reusing the match in THEN

Whatever your IF regex matched — the full text, a numbered group, or a named group — is available in THEN actions via `{{match}}`. See [`{{match}}` in THEN (Beta)](/actions/note-file-actions#match-in-then-beta).
