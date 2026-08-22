# Obsidian Plugin Development Rules — Index

Generic quick-reference for developing **any** Obsidian plugin — not tied to a specific project. Drop this whole `.claude/rules/` folder into any Obsidian plugin repo and it applies as-is; project-specific rules belong in that repo's own `CLAUDE.md` / `.claude/rules.md`, not here.

These rules apply whether the plugin ships TypeScript with a build step or plain JS with none — where the linked docs show a TypeScript example, apply the same underlying API/principle in JS; the syntax differs, the API contract doesn't.

Each file below is short and scoped to one concern — load only the one relevant to the task at hand instead of all of them.

## Topics

| File | Covers |
|---|---|
| [`submission-naming.md`](submission-naming.md) | Plugin ID/name/description rules, command IDs, `isDesktopOnly`, `fundingUrl`, no leftover sample code — validation-bot enforced |
| [`memory-lifecycle.md`](memory-lifecycle.md) | `registerEvent`/`registerInterval`/`registerDomEvent`, avoiding view references, `onunload()` cleanup |
| [`file-vault-api.md`](file-vault-api.md) | Editor API vs. `Vault.process()` vs. `Vault.modify()`, `FileManager.processFrontMatter()`, `normalizePath()`, `Platform` API, direct file lookups |
| [`ui-ux.md`](ui-ux.md) | Sentence case, `.setHeading()`, settings-heading conventions, `checkCallback`, CSS variables, scoping, no inline/runtime styles |
| [`accessibility.md`](accessibility.md) | Keyboard access, ARIA labels, focus indicators, touch targets — **mandatory**, not optional |

## Cross-cutting, not tied to one topic file

- **Type safety**: use `instanceof` instead of assuming a shape (`if (file instanceof TFile) { ... }`); in TypeScript avoid `any`, in plain JS validate defensively at runtime instead — especially anything coming from `loadData()`, which returns whatever was last saved, potentially from an older schema version.
- **Network calls**: use `requestUrl()`, never `fetch()` — bypasses CORS and works consistently across desktop and mobile. If the plugin makes network calls at all, disclose which remote services are used and why in the README, per the [developer policies](https://docs.obsidian.md/Developer+policies).
- **Security**: never `innerHTML`/`outerHTML` (XSS risk, review-bot disallowed) — use `createEl()`/`createDiv()`/`createSpan()`. Avoid regex lookbehind (unsupported on iOS < 16.4).
- **Secrets**: store API keys/tokens/passwords in Obsidian's secret storage, never in `data.json` or `localStorage`. A plugin with no secrets doesn't need this — just don't invent an unsanctioned place to put credentials if that ever changes.
- **Logging**: no `console.log()` in shipped code — `console.warn()`/`console.error()` only, and only on real error paths.

## Resources

- [Obsidian Plugin Docs](https://docs.obsidian.md/)
- [Obsidian API Docs](https://docs.obsidian.md/Reference/TypeScript+API/)
- [Obsidian Developer Policies](https://docs.obsidian.md/Developer+policies)
- [Obsidian Plugin Guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
- [eslint-plugin-obsidianmd](https://github.com/obsidianmd/eslint-plugin) — checks a plugin against the official guidelines automatically
