#!/usr/bin/env bash
# Capture receive + about from running Croc GUI (macOS).
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${REPO_ROOT}/docs/images/screenshots"

capture_window() {
  local outfile="$1"
  local bounds
  bounds=$(osascript <<'APPLESCRIPT'
tell application "System Events"
  tell process "gui"
    set frontmost to true
    delay 0.3
    set {x, y} to position of window 1
    set {w, h} to size of window 1
    return (x as text) & "," & (y as text) & "," & (w as text) & "," & (h as text)
  end tell
end tell
APPLESCRIPT
)
  screencapture -x -R"$bounds" "$outfile"
  echo "OK $outfile"
}

click_ui() {
  osascript <<APPLESCRIPT
tell application "System Events"
  tell process "gui"
    set frontmost to true
    delay 0.2
    $1
  end tell
end tell
APPLESCRIPT
}

wait_for_gui() {
  for i in $(seq 1 60); do
    pgrep -x gui >/dev/null && return 0
    sleep 1
  done
  return 1
}

if ! wait_for_gui; then
  echo "gui not running — start with: cd gui && npm run tauri:dev"
  exit 1
fi

# Cancel any in-flight transfer
click_ui 'key code 53'
sleep 0.5

# Receive tab
click_ui 'click radio button "Receive" of window 1'
sleep 0.6
capture_window "${OUT_DIR}/receive.png"

# About dialog
click_ui 'click button "About" of window 1'
sleep 0.6
capture_window "${OUT_DIR}/about.png"
click_ui 'key code 53'
sleep 0.3

# Send tab with options for reference
click_ui 'click radio button "Send" of window 1'
sleep 0.3

echo "Done"
