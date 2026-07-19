#!/usr/bin/env bash
#
# Notely.ai — one-command setup.
# Installs dependencies and builds the Mac app. After this finishes, open the app and paste
# your two keys (Anthropic + Notion) in Settings — this script never touches your keys.
#
set -euo pipefail

cd "$(dirname "$0")/.."

echo ""
echo "  Notely.ai — setup"
echo "  ─────────────────"
echo ""

# 1. Node check ---------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "  ✗ Node.js isn't installed."
  echo "    Install the LTS version from https://nodejs.org, then run this again."
  echo ""
  exit 1
fi
echo "  ✓ Node $(node -v)"

# 2. macOS check (electron-builder --mac target) ------------------------------
if [[ "$(uname)" != "Darwin" ]]; then
  echo "  ! This build script targets macOS. On another OS, use 'npm run build:win' or"
  echo "    'npm run build:linux' instead."
fi

# 3. Install deps -------------------------------------------------------------
echo ""
echo "  Installing dependencies (this can take a minute)…"
npm install

# 4. Build the app ------------------------------------------------------------
echo ""
echo "  Building the app…"
npm run build:mac

# 5. Done ---------------------------------------------------------------------
echo ""
echo "  ✓ Done. Installer built in the 'dist' folder (dist/notely-<version>.dmg)."
echo ""
echo "  Next steps:"
echo "    1. Open the .dmg in the dist folder and drag Notely.ai to Applications."
echo "    2. Launch it (first time: right-click ▸ Open to get past the 'unidentified"
echo "       developer' warning — it's unsigned because you built it yourself)."
echo "    3. Click Settings and paste your Anthropic API key (console.anthropic.com)."
echo "    4. Optionally add your Notion integration token to enable 'Send to Notion'."
echo ""
