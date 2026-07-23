# Croc GUI (developer guide)

Desktop GUI for [croc](https://github.com/schollz/croc) built with Tauri 2 + React. Overview: [root README](../README.md).

### Credits

- **croc** (transfer engine): [schollz/croc](https://github.com/schollz/croc) by Zack Scholl — [Sponsor schollz](https://github.com/sponsors/schollz)
- **Croc GUI** (this app): built by [**interfluve-wav**](https://github.com/interfluve-wav) — [croc-gui](https://github.com/interfluve-wav/croc-gui)

This app is a GUI wrapper around the upstream CLI — send/receive and crypto/relay logic come from croc, not a reimplementation.

Send and receive files with a code phrase. Options: custom code, relay, port, overwrite / auto-confirm, zip-before-send (any files/folders → one archive), zip-after-receive, **local-only** (`--local`), phrase QR, drag-and-drop send / paste-or-drop receive code, and remembered download folder / relay.

## Prerequisites

| Tool | Notes |
|------|--------|
| Node.js 20+ | Frontend + Tauri CLI |
| Rust (stable) | `rustup` recommended |
| Platform libs | Linux needs WebKitGTK 4.1 + GTK 3 (see below) |
| `croc` binary | Bundled into the app at build time |

### Linux packages (Debian/Ubuntu)

```bash
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev \
  patchelf libgtk-3-dev
```

### Windows

- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (or full VS)
- WebView2 (usually preinstalled on Windows 10/11)

## Setup

```bash
cd gui
npm install

# Option A — copy croc already on PATH / CROC_BIN
npm run bundle:croc

# Option B — download the latest GitHub release for this OS/arch
npm run bundle:croc:download
```

This places `croc` (or `croc.exe` on Windows) at `src-tauri/bin/`, which Tauri bundles as a resource.

## Develop

```bash
npm run tauri:dev
```

Optional override (dev only): `CROC_BIN=/path/to/croc npm run tauri:dev`

## Test

```bash
npm run test:rust
npm run build          # frontend typecheck + Vite build
```

## Production build (this machine)

```bash
npm run bundle:croc    # or bundle:croc:download
npm run tauri:build
```

### Where installers land

After `npm run tauri:build`, artifacts are under:

```
src-tauri/target/release/bundle/
```

Typical outputs by OS:

| OS | Artifacts |
|----|-----------|
| macOS | `macos/Croc.app`, `dmg/Croc_*.dmg` |
| Windows | `msi/*.msi`, `nsis/*.exe` (as enabled by Tauri) |
| Linux | `deb/*.deb`, `appimage/*.AppImage` (as enabled by Tauri) |

Cross-compiling on macOS (Intel app from Apple Silicon):

```bash
rustup target add x86_64-apple-darwin
npm run bundle:croc:download   # use a matching arch binary on CI / that runner
npx tauri build --target x86_64-apple-darwin
# → src-tauri/target/x86_64-apple-darwin/release/bundle/
```

## Local-only transfers

Enable **Local-only (--local)** under Options on both Send and Receive. This passes upstream `croc --local` so peers discover each other on the LAN and do not use the public relay. Both machines should be on the same network (and both sides should enable the option).

## Drag and drop

| Mode | Behavior |
|------|----------|
| Send | Drop files or folders onto the drop zone (Tauri file drop). Buttons still work. |
| Receive | Paste or drop a code phrase (or `croc <phrase>`) into the code field. |

## Drag-and-drop (Send)

Uses Tauri 2 `getCurrentWebview().onDragDropEvent` so dropped files/folders arrive as **absolute paths** (required by `croc send`). No extra capability beyond `core:default` — window `dragDropEnabled` defaults to on. Highlight appears when the pointer is over the send drop zone.

## Zip options

| Mode | Option | Behavior |
|------|--------|----------|
| Send | **Zip all items before sending** | Stages selected files and/or folders into a temp dir, builds one `.zip` (Rust `zip` crate), then `croc send`s that archive. Temp staging is removed when the transfer ends or is cancelled. |
| Receive | **Zip newly received files after transfer** | After exit 0, the GUI zips only *new* top-level items in the download folder into `croc-received-<timestamp>.zip` (Rust `zip` crate). Requires a download folder. Original received files are left in place. |

Limits: receive zip compares top-level names before/after transfer (not a full croc manifest). Empty receive → no zip. Very large trees may take a moment to pack.

## CI

GitHub Actions workflow [`.github/workflows/build-gui.yml`](../.github/workflows/build-gui.yml) builds installers for:

- macOS aarch64 + x86_64
- Windows x64
- Linux x64

Each job downloads the matching `schollz/croc` release asset into `src-tauri/bin/`, then runs `tauri build` and uploads bundle artifacts.

## License & attribution

- Upstream **[schollz/croc](https://github.com/schollz/croc)** is MIT (Zack Scholl / contributors). Support the author: **[Sponsor / support schollz](https://github.com/sponsors/schollz)**.
- This GUI is a separate MIT-licensed wrapper (see repo-root [`LICENSE`](../LICENSE)). Bundled `croc` binaries remain under upstream’s terms.

## Notes

- v1 uses the **bundled** `croc` only at runtime (no PATH fallback). `CROC_BIN` is for development/override only.
- Binary resolution prefers `…/bin/croc[.exe]`, with nested `resources/bin` and a few layout fallbacks for packaged `.app` / installers.
- Upstream CLI behavior is unchanged; this app shells out and streams stdout/stderr.
