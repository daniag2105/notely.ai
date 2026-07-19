#!/usr/bin/env bash
#
# Notely.ai — double-click setup for Mac.
# Just double-click this file in Finder. It installs everything, builds the app, and opens the
# installer for you. You never have to type a command. Your keys are entered later, inside the
# app — this script never touches them.
#
# First time: if macOS says this file "can't be opened", right-click it ▸ Open ▸ Open.

# Run from this file's own folder, no matter where it's launched from.
cd "$(dirname "$0")"

# Do the real work (install + build). Not using `set -e` here so the window stays open on an error.
bash scripts/setup.sh

# If a .dmg got built, open it so they can drag Notely.ai to Applications.
dmg="$(ls dist/*.dmg 2>/dev/null | head -1 || true)"
if [ -n "$dmg" ]; then
  echo "  Opening the installer…"
  open "$dmg"
fi

echo ""
read -n 1 -s -r -p "  All done — press any key to close this window."
echo ""
