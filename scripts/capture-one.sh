#!/usr/bin/env bash
# Capture a single Croc GUI state. Usage: capture-one.sh <name> [click-rx ry]...
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${REPO_ROOT}/docs/images/screenshots"
APP_PATH="${REPO_ROOT}/gui/src-tauri/target/release/bundle/macos/Croc.app"
NAME="$1"
shift

mkdir -p "$OUT_DIR"

ensure_app() {
  if ! pgrep -x gui >/dev/null 2>&1; then
    open -a "$APP_PATH"
    sleep 3
  fi
}

click_at() {
  local rx="$1" ry="$2"
  osascript <<APPLESCRIPT
tell application "System Events"
  tell process "gui"
    set frontmost to true
    delay 0.25
    set {wx, wy} to position of window 1
    set {ww, wh} to size of window 1
    click at {wx + (ww * $rx), wy + (wh * $ry)}
  end tell
end tell
APPLESCRIPT
}

capture() {
  local outfile="$1"
  local bounds
  bounds=$(osascript <<'APPLESCRIPT'
tell application "System Events"
  tell process "gui"
    set frontmost to true
    set {x, y} to position of window 1
    set {w, h} to size of window 1
    return (x as text) & "," & (y as text) & "," & (w as text) & "," & (h as text)
  end tell
end tell
APPLESCRIPT
)
  screencapture -x -R"$bounds" "$outfile"
  echo "OK $outfile ($bounds)"
}

ensure_app

while [[ $# -ge 2 ]]; do
  click_at "$1" "$2"
  sleep 0.6
  shift 2
done

capture "${OUT_DIR}/${NAME}.png"
