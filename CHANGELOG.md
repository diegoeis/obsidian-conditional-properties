# Changelog

## 0.16.2 - 2026-02-02
### Bug Fixes
- **Fixed first level heading detection with MetadataCache**: Added fallback to read file content directly when MetadataCache hasn't been updated yet
- This resolves issues where `notExists` or `isEmpty` conditions on FIRST_LEVEL_HEADING were not triggering for recently created or modified files
- The plugin now reliably detects H1 headings regardless of cache state, ensuring consistent behavior

### Technical Details
- `_getNoteTitle()` now attempts to read file content directly if cache.headings is empty or undefined
- Uses regex pattern `/^#\s+(.+)$/m` as fallback to detect H1 headings
- Maintains backward compatibility with existing MetadataCache-based detection for performance

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
