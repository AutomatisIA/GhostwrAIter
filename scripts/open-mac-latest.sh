#!/bin/zsh

set -euo pipefail

SCRIPT_DIR=${0:A:h}
REPO_ROOT=${SCRIPT_DIR:h}
APP_PATH="$REPO_ROOT/dist-app/mac-arm64/LinkedIn Poster.app"

mkdir -p "$REPO_ROOT/dist-launcher"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] launch requested"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm introuvable dans le PATH du shell GUI."
  exit 1
fi

osascript -e 'tell application id "com.philippe.linkedin-poster" to quit' >/dev/null 2>&1 || true

cd "$REPO_ROOT"
npm run package:mac

if [[ ! -d "$APP_PATH" ]]; then
  echo "Application packagee introuvable: $APP_PATH"
  exit 1
fi

open -na "$APP_PATH"
