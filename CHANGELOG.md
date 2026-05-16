# Changelog

## 0.16.3 - 2026-05-16
### Improvements
- **README**: removed "(Coming Soon)" placeholder from the Community Plugins install section; the plugin is published, so the placeholder no longer applies.
- **Roadmap**: marked the rename-property action and the title overwrite / `{filename}` / `{date:FORMAT}` placeholders as shipped (they landed in v0.16.0 and v0.15.0 respectively and were still showing as pending).
- **styles.css**: removed all `!important` declarations in the active stylesheet and replaced shorthand hex `#fff` with the full 6-digit `#ffffff`. The red-button variant now wins through selector specificity (`#eis-cp-plugin button.eis-btn.eis-btn-red`) instead of `!important`, and the hover color reuses the `--text-on-accent` CSS variable. Cleared the warnings reported by the community CSS lint at `styles.css:78–80` and `styles.css:100`.
- **Release workflow**: now uploads `main.js`, `styles.css`, `manifest.json`, `versions.json`, the zip, and `LICENSE` individually to the GitHub Release (previously only the zip and manifest were attached, which made the LICENSE file invisible to release-asset validators).
- **Artifact attestations**: the release workflow now generates GitHub artifact attestations for `main.js`, `styles.css`, and `manifest.json` via `actions/attest-build-provenance@v2`, so users can cryptographically verify the release came from this repo. Required adding `id-token: write` and `attestations: write` to the workflow permissions.

### Why
Hygiene release driven by the community-plugin validator: the previous release was flagged for unfilled README placeholders, `!important` / 3-digit hex in `styles.css`, and missing artifact attestations. No runtime behavior changed.

## 0.16.2 - 2026-02-02
### Breaking Changes
- **H1 detection now only considers headings immediately after YAML frontmatter**: The plugin now only checks for H1 headings that appear at the beginning of the content, right after the YAML frontmatter. H1 headings elsewhere in the document are ignored.
- This ensures consistent behavior where the "title" of a note is always the first H1 after frontmatter, not random H1s scattered throughout the document.

### Bug Fixes
- Fixed `notExists` and `isEmpty` operators to correctly identify files without a title H1
- Plugin no longer considers H1 headings in the middle or end of documents as the "title"

### Technical Details
- `_getNoteTitle()` now reads file content directly and checks only for H1 immediately after YAML
- `_updateNoteTitle()` ensures H1 is always placed/updated right after YAML frontmatter
- Removed dependency on MetadataCache.headings to avoid false positives from H1s elsewhere in the document

## 0.16.0 - 2026-01-12
### New Features
- **RENAME property action**: New action to rename properties while preserving their values. Use "Rename property to" option in THEN actions to change property names (e.g., rename `old_company` to `company`)

### Improvements
- Case-insensitive property name matching for rename operations
- Automatic protection against overwriting existing properties during rename
- Clean removal of old property after successful rename

## 0.15.0 - 2026-01-08
### New Features
- **OVERWRITE TO option for title modification**: Completely replace note titles instead of just adding prefix/suffix
- **{filename} placeholder**: New placeholder that inserts the file's basename (without .md extension)
- **Combined placeholders**: Mix {date}, {date:FORMAT}, and {filename} in any order (e.g., `{date:YYYY-MM-DD} - {filename}`)
- **Auto-create H1 headings**: When using `notExists` or `isEmpty` operators with FIRST LEVEL HEADING, the plugin now creates H1 headings automatically
- **Improved UI**: Text input field now hides automatically when using `exists`, `notExists`, or `isEmpty` operators

### Bug Fixes
- Fixed issue where rules with `notExists` or `isEmpty` operators on FIRST LEVEL HEADING were being skipped
- Fixed `isEmpty` operator returning false for non-existent headings instead of true
- Fixed OVERWRITE TO not working when H1 heading doesn't exist

### Improvements
- OVERWRITE TO now properly handles notes without H1 headings
- Frontmatter `title` property remains untouched (plugin only modifies H1 headings)
- Better operator handling for FIRST LEVEL HEADING conditions

## 0.1.0 - 2025-10-13
- Initial release
- Rules engine with operators (equals/contains/notEquals)
- Run on vault and current file
- Scheduled scans (min 5 minutes)
- Settings UI and Run now button
- Multi-value property handling
