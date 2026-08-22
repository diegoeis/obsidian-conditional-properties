# Developer policies

Mirror of https://docs.obsidian.md/community-directory/developer-policies — check the live page if this file looks stale.

Also read the [Submission requirements for plugins](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins).

---

Our goal for community plugins and themes is to make it easy for users to safely modify and expand the capabilities of Obsidian, while prioritizing private and offline usage of the app.

All community plugins and themes added to the Obsidian directory must respect the following policies. Plugins and themes that don't follow these policies will be removed from the directory.

These policies only apply to plugins listed in the official [Obsidian Community](https://community.obsidian.md/) directory. These policies do not apply to plugins installed outside of the Obsidian directory, but they are nonetheless good practices to follow.

## Policies

### Not allowed

Plugins and themes must not:

- Obfuscate code to hide its purpose.
- Insert dynamic ads that are loaded over the internet.
- Insert static ads outside a plugin's own interface.
- Include client-side telemetry.
- Install or update themselves or their dependencies.
- Themes may not load assets from the network. To bundle an asset, see [this guide](https://docs.obsidian.md/Themes/App+themes/Embed+fonts+and+images+in+your+theme).

### Disclosures

The following are only allowed if clearly indicated in your README:

- Payment is required for full access.
- An account is required for full access.
- Network use. Clearly explain which remote services are used and why they're needed.
- Accessing files outside of Obsidian vaults. Clearly explain why this is needed.
- Static ads such as banners and pop-up messages within the plugin's own interface.
- Server-side telemetry. Link to a privacy policy that explains how the data is handled must be included.
- Close sourced code. This will be handled on a case by case basis.

All community plugins and themes must follow these requirements:

- Include a [LICENSE file](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/adding-a-license-to-a-repository) and clearly indicate the license of your plugin or theme.
- Comply with the original licenses of any code your plugin or theme makes use of, including attribution in the README if required.
- Respect Obsidian's trademark policy. Don't use the "Obsidian" trademark in a way that could confuse users into thinking your plugin or theme is a first-party creation.

### Forks

We encourage developers to collaborate on fewer high-quality projects than many low-quality ones. Consider contributing to existing projects rather than creating new projects that duplicate existing functionality.

[Forks](<https://en.wikipedia.org/wiki/Fork_(software_development)>) are not allowed in the Community directory unless they meet one of the following criteria:

- The fork has received explicit written approval from the original author in a publicly verifiable way.
- The fork author can show proof that the original author is unreachable and has not updated the project for at least 6 months. After those 6 months have passed, contact the original author and allow them 30 days to publicly acknowledge your request before proceeding.

In both cases, the original author must be credited as a contributor to the new project.

If your project diverges from existing options, it should not be a fork. Start fresh with a new repository and your own code. It should inherit no code from the original repo without explicit permission.

## Reporting violations

If you encounter a plugin or theme that violates the policies above, please let the developer know by opening a GitHub issue in their repository. Kindly check existing issues to see if it's already reported.

If the developer doesn't respond after 7 days, [contact the Obsidian team](https://help.obsidian.md/Help+and+support#Report+a+security+issue). For serious violations, you can contact our team immediately.

## Removing plugins and themes

In case of a policy violation, we may attempt to contact the developer and provide a reasonable timeframe for them to resolve the problem.

If the problem isn't resolved by then, we'll remove plugins or themes from our directory.

We may immediately remove a plugin or theme if:

- The plugin or theme appears to be malicious.
- The developer is uncooperative.
- This is a repeated violation.

In addition, we may also remove plugins or themes that have become unmaintained or severely broken.

---

## How this applies to Conditional Properties

- **No network use** — the plugin makes zero `requestUrl`/`fetch` calls. Nothing to disclose here; keep it that way, or add a README disclosure the moment that changes.
- **No accounts, no payment gate** — fully local, free.
- **No client-side telemetry** — no analytics, no usage tracking.
- **No self-update mechanism** — updates go through Obsidian's own Community Plugins update flow, never a custom updater.
- **No file access outside the vault** — all reads/writes go through `app.vault`/`app.fileManager`, which are sandboxed to the vault. Note file actions (rename/move) are explicitly sanitized against `../` traversal so a placeholder-expanded value can never write outside the vault (see `_sanitizeFilenameComponent` / `_sanitizeVaultFolderPath` in `main.js`).
- **LICENSE** — MIT, present at the repo root.
- **Not a fork** — original code, not derived from another plugin's repo.
