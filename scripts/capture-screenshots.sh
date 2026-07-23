#!/usr/bin/env bash
# Capture Croc GUI window screenshots on macOS (AppleScript + screencapture).
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${REPO_ROOT}/docs/images/screenshots"
APP_PATH="${REPO_ROOT}/gui/src-tauri/target/release/bundle/macos/Croc.app"
DEMO_DIR="/tmp/croc-gui-demo"

mkdir -p "$OUT_DIR"

if [[ ! -d "$APP_PATH" ]]; then
  echo "Croc.app not found at $APP_PATH — run: cd gui && npm run tauri:build"
  exit 1
fi

# Quit any running instance
osascript <<'APPLESCRIPT' 2>/dev/null || true
tell application "System Events"
  if exists process "gui" then tell process "gui" to quit
end tell
APPLESCRIPT
sleep 1

open -a "$APP_PATH"
sleep 3

capture_window() {
  local outfile="$1"
  local bounds
  bounds=$(osascript <<'APPLESCRIPT'
tell application "System Events"
  tell process "gui"
    set frontmost to true
    delay 0.2
    set {x, y} to position of window 1
    set {w, h} to size of window 1
    return (x as text) & "," & (y as text) & "," & (w as text) & "," & (h as text)
  end tell
end tell
APPLESCRIPT
)
  if [[ -z "$bounds" ]]; then
    echo "ERROR: Croc window not found for $outfile"
    return 1
  fi
  screencapture -x -R"$bounds" "$outfile"
  echo "Captured $outfile ($bounds)"
}

click_at() {
  local rx="$1"
  local ry="$2"
  osascript <<APPLESCRIPT
tell application "System Events"
  tell process "gui"
    set frontmost to true
    delay 0.2
    set {wx, wy} to position of window 1
    set {ww, wh} to size of window 1
    set cx to wx + (ww * $rx)
    set cy to wy + (wh * $ry)
    click at {cx, cy}
  end tell
end tell
APPLESCRIPT
}

click_named() {
  local role="$1"
  local name="$2"
  osascript <<APPLESCRIPT
tell application "System Events"
  tell process "gui"
    set frontmost to true
    delay 0.2
    try
      click $role "$name" of window 1
    on error
      -- Fallback: search entire UI tree
      set target to first UI element whose name is "$name"
      click target
    end try
  end tell
end tell
APPLESCRIPT
}

click_button() {
  click_named "button" "$1"
}

click_radio() {
  click_named "radio button" "$1"
}

press_escape() {
  osascript <<'APPLESCRIPT'
tell application "System Events"
  tell process "gui"
    set frontmost to true
    key code 53
  end tell
end tell
APPLESCRIPT
}

add_demo_files() {
  osascript <<APPLESCRIPT
tell application "System Events"
  tell process "gui"
    set frontmost to true
    delay 0.3
    click button "Add files" of window 1
  end tell
end tell
delay 1
tell application "System Events"
  keystroke "g" using {command down, shift down}
  delay 0.5
  keystroke "$DEMO_DIR"
  keystroke return
  delay 0.5
  keystroke "readme.txt"
  keystroke return
  delay 0.3
  keystroke "sample.dat"
  keystroke return
  delay 0.3
  keystroke return
end tell
APPLESCRIPT
}

# Send tab (default)
capture_window "${OUT_DIR}/send.png"

# Options expanded (~45% down, left side of options bar)
click_at 0.12 0.46
sleep 0.5
capture_window "${OUT_DIR}/options.png"
click_at 0.12 0.46
sleep 0.3

# Receive tab (~top-right mode switcher)
click_at 0.82 0.12
sleep 0.5
capture_window "${OUT_DIR}/receive.png"

# About dialog
click_at 0.88 0.08
sleep 0.5
capture_window "${OUT_DIR}/about.png"
press_escape
sleep 0.3

# Send tab + start transfer for QR / progress
click_at 0.68 0.12
sleep 0.5

# Ensure files for send (Add files + macOS open dialog)
click_at 0.28 0.36
sleep 1
osascript <<APPLESCRIPT
tell application "System Events"
  keystroke "g" using {command down, shift down}
  delay 0.4
  keystroke "$DEMO_DIR"
  keystroke return
  delay 0.4
  keystroke "a" using command down
  delay 0.2
  keystroke return
end tell
APPLESCRIPT
sleep 0.8
capture_window "${OUT_DIR}/send-files.png" || true

click_at 0.14 0.62
sleep 4
capture_window "${OUT_DIR}/send-qr.png" || true

# Wait for progress if transfer started
sleep 2
capture_window "${OUT_DIR}/progress.png" 2>/dev/null || true

# Use best send shot as send.png if we got files variant
if [[ -f "${OUT_DIR}/send-files.png" ]]; then
  mv "${OUT_DIR}/send-files.png" "${OUT_DIR}/send.png"
fi

# Prefer QR shot merged into send if no files shot
if [[ -f "${OUT_DIR}/send-qr.png" ]] && [[ ! -s "${OUT_DIR}/send.png" ]]; then
  cp "${OUT_DIR}/send-qr.png" "${OUT_DIR}/send.png"
fi

# Cleanup temp
rm -f "${OUT_DIR}/send-files.png" "${OUT_DIR}/send-qr.png"

# Compress large PNGs if pngquant available
if command -v pngquant >/dev/null 2>&1; then
  for f in "${OUT_DIR}"/*.png; do
    [[ -f "$f" ]] || continue
    pngquant --force --skip-if-larger --quality=80-95 --ext .png -- "$f" 2>/dev/null || true
  done
fi

# Quit app
osascript <<'APPLESCRIPT' 2>/dev/null || true
tell application "System Events"
  if exists process "gui" then tell process "gui" to quit
end tell
APPLESCRIPT

ls -la "${OUT_DIR}/"
