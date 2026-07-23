<p align="center">
  <img src="docs/images/logo.png" alt="Croc GUI logo" width="96" height="96" />
</p>

<h1 align="center">Croc GUI</h1>

<p align="center">
  A desktop front end for securely sending and receiving files with
  <a href="https://github.com/schollz/croc">croc</a>.
  Built for people who want the reliability of the CLI without living in the terminal.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-0B6E4F?style=flat-square" alt="MIT License" /></a>
  <a href="#install--download"><img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-1F6FEB?style=flat-square" alt="Platforms" /></a>
  <a href="https://tauri.app/"><img src="https://img.shields.io/badge/built%20with-Tauri%202-FFC131?style=flat-square" alt="Tauri" /></a>
  <a href="https://github.com/interfluve-wav/croc-gui/actions/workflows/build-gui.yml"><img src="https://img.shields.io/github/actions/workflow/status/interfluve-wav/croc-gui/build-gui.yml?branch=main&style=flat-square&label=CI" alt="Build status" /></a>
  <a href="https://github.com/interfluve-wav/croc-gui/releases"><img src="https://img.shields.io/github/v/release/interfluve-wav/croc-gui?include_prereleases&style=flat-square&label=release" alt="Release" /></a>
</p>

<p align="center">
  <a href="https://github.com/sponsors/schollz"><img src="https://img.shields.io/badge/sponsor-schollz%20%2F%20croc-ea4aaa?style=flat-square&logo=githubsponsors&logoColor=white" alt="Sponsor schollz" /></a>
  <a href="https://github.com/schollz/croc"><img src="https://img.shields.io/badge/powered%20by-schollz%2Fcroc-111827?style=flat-square" alt="Powered by schollz/croc" /></a>
  <a href="https://github.com/interfluve-wav/croc-gui"><img src="https://img.shields.io/badge/GUI%20by-interfluve--wav-0B6E4F?style=flat-square" alt="GUI by interfluve-wav" /></a>
</p>

---

## What this is

**Croc GUI** is a cross-platform desktop app (Tauri 2 + React) that shells out to a **bundled** [croc](https://github.com/schollz/croc) binary. It does not reimplement the transfer protocol. Send, receive, relays, crypto, and codes remain upstream croc.

**Who it’s for:** anyone who already uses (or wants) croc for ad-hoc, end-to-end encrypted transfers and prefers a clear Send / Receive UI—code phrases, QR, drag-and-drop, and sensible options—on macOS, Windows, or Linux.

### Credits

| Layer | Credit |
|-------|--------|
| **croc** (transfer engine) | [Zack Scholl / schollz](https://github.com/schollz) — [schollz/croc](https://github.com/schollz/croc) — [Sponsor schollz](https://github.com/sponsors/schollz) |
| **Croc GUI** (this desktop app) | Built by **Suhaas** / [**interfluve-wav**](https://github.com/interfluve-wav) — [interfluve-wav/croc-gui](https://github.com/interfluve-wav/croc-gui) · [suhaaschitturi.com](https://suhaaschitturi.com) |

This repository is a GUI wrapper around upstream croc, not a claim of authorship over the protocol or CLI.

---

## Screenshots

Real window captures belong in [`docs/images/`](docs/images/) (`send.png`, `receive.png` — see [capture guide](docs/images/README.md)). Until those land, here is how the stack fits together:

![Architecture: UI → Tauri → croc CLI](docs/images/architecture.svg)

---

## Features

- **Send / Receive** modes with live transfer status
- **Code phrase** display, copy phrase, and copy full `croc …` command
- **QR code** for the phrase (easy hand-off to a phone or second machine)
- **Drag-and-drop** send (files/folders) and paste/drop receive codes
- **Options:** custom code, relay, port, overwrite, auto-confirm (`-yes`)
- **Local-only** transfers (`croc --local`) — LAN peers, no public relay
- **Zip on send** (`croc send --zip`) and **zip after receive** (GUI helper)
- **Preferences:** remembered download folder and default relay
- **About** dialog with version and dual attribution (GUI + upstream)
- Bundled **croc** binary (no PATH dependency at runtime)

---

## Install / download

Prebuilt installers are published on **[GitHub Releases](https://github.com/interfluve-wav/croc-gui/releases)**.

| Platform | Typical artifacts |
|----------|-------------------|
| macOS | `.dmg` / `.app` (arm64 and/or x86_64) |
| Windows | `.msi` / NSIS `.exe` |
| Linux | `.deb` / `.AppImage` |

CI also uploads per-OS build artifacts from [Build Croc GUI](https://github.com/interfluve-wav/croc-gui/actions/workflows/build-gui.yml) on pushes and pull requests that touch `gui/`.

---

## Quick start

### Use a release build

1. Download the installer for your OS from [Releases](https://github.com/interfluve-wav/croc-gui/releases).
2. Install and open **Croc**.
3. Choose **Send** or **Receive**, set options if needed, and transfer.

### Develop locally

```bash
git clone https://github.com/interfluve-wav/croc-gui.git
cd croc-gui/gui
npm install
npm run bundle:croc          # or: npm run bundle:croc:download
npm run tauri:dev
```

Developer details (prerequisites, zip behavior, artifact paths): [`gui/README.md`](gui/README.md).

---

## Building from source

Requirements: **Node.js 20+**, **Rust (stable)**, and platform UI libraries (see [`gui/README.md`](gui/README.md)).

```bash
cd gui
npm install
npm run bundle:croc:download   # stage matching upstream croc binary
npm run test:rust
npm run tauri:build
```

Installers land under `gui/src-tauri/target/release/bundle/` (or the architecture-specific target dir when cross-building on macOS).

| OS | Notes |
|----|--------|
| **macOS** | Xcode CLT; optional `rustup target add x86_64-apple-darwin` for Intel builds from Apple Silicon |
| **Windows** | MSVC Build Tools + WebView2 |
| **Linux** | WebKitGTK 4.1 + GTK 3 (Debian/Ubuntu package list in `gui/README.md`) |

Cross-platform packaging is covered by [`.github/workflows/build-gui.yml`](.github/workflows/build-gui.yml).

---

## Roadmap

Product direction (Next up vs Later): [`docs/ROADMAP.md`](docs/ROADMAP.md).

Highlights under consideration: richer progress and history, private-relay profiles, OS share integrations and signed auto-updates, power-user profiles, and accessibility / i18n.

---

## Project layout

```
croc-gui/
├── gui/                 # Tauri 2 + React app
├── docs/                # Specs, plans, images, roadmap
├── .github/             # CI, issue & PR templates
└── LICENSE
```

---

## Support & upstream

| Topic | Where |
|-------|--------|
| This GUI (UI, packaging, wrappers) | [Issues in this repo](https://github.com/interfluve-wav/croc-gui/issues) |
| croc protocol / CLI behavior | [schollz/croc issues](https://github.com/schollz/croc/issues) |
| Sponsor upstream | [github.com/sponsors/schollz](https://github.com/sponsors/schollz) |
| GUI maintainer | [interfluve-wav](https://github.com/interfluve-wav) · [Suhaas](https://suhaaschitturi.com) |

More detail: [`SUPPORT.md`](SUPPORT.md).

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Please follow the [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Security reports: [`SECURITY.md`](SECURITY.md).

---

## License

- **This GUI** is MIT — see [`LICENSE`](LICENSE).
- **Upstream croc** is also MIT (copyright Zack Scholl / contributors). Bundled binaries remain under upstream’s terms. See [schollz/croc](https://github.com/schollz/croc) for the authoritative upstream license text.

---

<p align="center">
  <sub>
    <a href="https://github.com/interfluve-wav/croc-gui">Croc GUI</a> by
    <a href="https://github.com/interfluve-wav">Suhaas / interfluve-wav</a>
    · Powered by <a href="https://github.com/schollz/croc">schollz/croc</a>
    · <a href="https://github.com/sponsors/schollz">Sponsor schollz</a>
  </sub>
</p>
