# App window screenshots

Real Croc GUI captures for the repo README and promo posts.

| File | Content |
|------|---------|
| `send.png` | Send tab — drag-and-drop, ready to start (native macOS window) |
| `receive.png` | Receive tab — code phrase + download folder |
| `options.png` | Options expanded — relay, local-only, zip, etc. (native macOS window) |
| `about.png` | About dialog — version + dual attribution |
| `progress.png` | Send in progress — code phrase, QR, transfer status |

## How these were captured

### Native macOS (`send.png`, `options.png`)

1. Build or run the app: `cd gui && npm run tauri:dev` (or open a release `Croc.app`).
2. Run from repo root:

   ```bash
   ./scripts/capture-screenshots.sh
   ```

   Uses `screencapture -R` + AppleScript coordinate clicks. Requires Accessibility permission for Terminal/Cursor.

### Vite + Playwright (`receive.png`, `about.png`, `progress.png`)

For tabs/dialogs that are awkward to automate in the native shell, the dev server supports `?capture=` query presets:

```bash
cd gui
npm run dev          # terminal 1
node scripts/capture-web.mjs   # terminal 2
```

Presets live in `gui/src/App.tsx` (`import.meta.env.DEV` only). `progress` uses demo paths/codes — no real files or secrets.

## Re-capture checklist

- Use a neutral desktop background; crop to the app window.
- Prefer ~720×640 (default window) or 2× retina PNGs.
- Avoid personal paths, relay passwords, or live transfer codes in commits.
- Compress large PNGs: `pngquant --quality=80-95 --ext .png --force *.png` (optional).

## Video / GIF (optional)

Not checked in. To record a short demo on macOS:

```bash
# QuickTime: File → New Screen Recording, or
screencapture -v /tmp/croc-demo.mov   # then trim in QuickTime
```

Save as `demo.mp4` here and link from the root README if you add one.
