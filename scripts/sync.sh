#!/usr/bin/env bash
#
# Sync the working-copy plugin assets into the user's active Obsidian vault
# and reload the plugin via the Obsidian CLI.
#
# This is the local "F5" for this repo. There is no build step — main.js is
# hand-written and shipped as-is, so syncing is just `cp` + `plugin:reload`.
#
# Usage:
#   ./scripts/sync.sh
#
# Override the target plugin folder by exporting OBSIDIAN_PLUGIN_DIR before
# running (e.g. when testing in a different vault).

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_ID="conditional-properties"
DEFAULT_TARGET="/Users/diegoeis/obs-notes/.obsidian/plugins/${PLUGIN_ID}"
TARGET_DIR="${OBSIDIAN_PLUGIN_DIR:-$DEFAULT_TARGET}"

FILES=(main.js styles.css manifest.json)

cd "$REPO_DIR"

# Sanity: refuse to run if any expected source file is missing.
for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "✗ missing source file: $f" >&2
    exit 1
  fi
done

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "✗ target plugin folder not found: $TARGET_DIR" >&2
  echo "  Set OBSIDIAN_PLUGIN_DIR or install the plugin in the vault first." >&2
  exit 1
fi

cp "${FILES[@]}" "$TARGET_DIR/"

if ! command -v obsidian >/dev/null 2>&1; then
  echo "✓ copied to $TARGET_DIR"
  echo "  (obsidian CLI not found — reload the plugin manually)"
  exit 0
fi

obsidian "plugin:reload" "id=${PLUGIN_ID}"
printf "✓ reloaded at %s\n" "$(date +%H:%M:%S)"
