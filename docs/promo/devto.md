# dev.to launch post

Optional article for dev.to — good for SEO and developer audience. Publish after Releases has binaries.

---

## Suggested title

```
I built a desktop GUI for croc — encrypted file transfer without the terminal
```

**Alternates:**
- `Croc GUI: Tauri wrapper for peer-to-peer file transfer with schollz/croc`
- `Shipping a cross-platform GUI for croc in Tauri 2`

**Tags:** `#opensource` `#rust` `#react` `#showdev` `#security`

**Cover image:** `docs/images/banner-hero.png` (upload to dev.to)

---

## Article outline

Use this structure for a ~800–1200 word post, or paste the short version below.

### 1. Hook (problem)

- Ad-hoc file sharing options: email limits, cloud uploads, USB drives, `scp` friction
- croc solves this CLI-side — encrypted P2P with a code phrase
- Gap: non-terminal users and daily desktop workflow

### 2. What Croc GUI is

- Tauri 2 + React desktop app
- Bundles upstream croc — no protocol reimplementation
- macOS, Windows, Linux
- Link: https://github.com/interfluve-wav/croc-gui

### 3. Feature tour (screenshots when available)

- Send: drag-drop, phrase, QR
- Receive: paste code, pick folder
- Options: local-only, relay, zip, proxy
- Progress and copy-full-command for power users

### 4. Architecture (brief)

```
React UI → Tauri commands → bundled croc binary → P2P transfer
```

- Reference `docs/images/architecture.svg`
- Why shell-out vs embed: upstream compatibility, security boundaries

### 5. Credits & disclaimer

- schollz/croc — sponsor link
- Not official — interfluve-wav community GUI
- MIT license

### 6. Try it / contribute

- Releases URL
- `npm run tauri:dev` quick start
- Issues welcome — relay profiles, Homebrew next

### 7. Closing

- Who it's for
- Star + sponsor upstream CTA

---

## Short launch post (paste-ready body)

```markdown
## TL;DR

**[Croc GUI](https://github.com/interfluve-wav/croc-gui)** is a free desktop app for [schollz/croc](https://github.com/schollz/croc) — encrypted peer-to-peer file transfer with drag-and-drop, QR codes, and LAN mode. macOS, Windows, Linux. MIT licensed.

Download: [GitHub Releases](https://github.com/interfluve-wav/croc-gui/releases)

---

## Why I built this

I send files with **croc** all the time. It's end-to-end encrypted, works across platforms, and doesn't park your data on a vendor cloud. The CLI is great — until you're helping someone who doesn't have a terminal open.

Croc GUI is the Send/Receive desktop app I wanted: same croc binary, clearer UX.

## What it does

- **Send** — drag files/folders, get a code phrase + QR
- **Receive** — paste a code, pick a download folder
- **Local-only** — `croc --local` for LAN peers
- **Zip** — pack on send, unpack helper on receive
- **Options** — relay, port, proxy, overwrite, auto-confirm
- **Progress** — live status from croc output

## What it doesn't do

- Reimplement croc's crypto or protocol
- Upload anything to a GUI-specific cloud
- Claim to be an official schollz project

Transfer engine: **[schollz/croc](https://github.com/schollz/croc)**. Please **[sponsor schollz](https://github.com/sponsors/schollz)** if croc saves you time.

## Stack

- **UI:** React + TypeScript
- **Shell:** Tauri 2 (Rust)
- **Engine:** bundled croc binary per platform

![Architecture](https://raw.githubusercontent.com/interfluve-wav/croc-gui/main/docs/images/architecture.svg)

## Dev quick start

```bash
git clone https://github.com/interfluve-wav/croc-gui.git
cd croc-gui/gui
npm install
npm run bundle:croc:download
npm run tauri:dev
```

## What's next

Relay profiles, local transfer history, README screenshots, and package-manager distribution (Homebrew, winget, Flatpak) — see the [roadmap](https://github.com/interfluve-wav/croc-gui/blob/main/docs/ROADMAP.md).

⭐ [Star on GitHub](https://github.com/interfluve-wav/croc-gui) · 🐛 [Issues](https://github.com/interfluve-wav/croc-gui/issues) · ⬇ [Releases](https://github.com/interfluve-wav/croc-gui/releases)
```

---

## Publishing checklist

- [ ] Cover image uploaded (`banner-hero.png`)
- [ ] Canonical URL set to GitHub repo
- [ ] Tags: opensource, rust, react, showdev
- [ ] Cross-link from README promo section (optional)
- [ ] Reply to comments for 48h after publish
