# Reddit promo

Paste-ready copy. **Read each sub's rules before posting.** Most subs limit self-promo to one post per project; be transparent that this is an unofficial GUI wrapper.

---

## Subreddit-specific titles

### r/selfhosted

**Title:** Croc GUI — desktop app for schollz/croc encrypted P2P file transfer (no cloud upload, LAN mode, drag-drop)

**Angle:** Self-hosted / privacy — no accounts, no vendor cloud, optional self-hosted relay, local-only LAN transfers.

---

### r/macapps

**Title:** [App] Croc GUI — drag-and-drop encrypted file sharing for croc on macOS (and Windows/Linux)

**Angle:** Native-feeling desktop app, `.dmg` installer, QR codes for AirDrop-adjacent workflows without Apple lock-in.

---

### r/linux

**Title:** Croc GUI — cross-platform desktop front end for schollz/croc (`.deb`, AppImage, encrypted P2P)

**Angle:** Linux packaging, open source, alternative to `croc` CLI for desktop users.

---

### r/commandline

**Title:** I wrapped croc in a GUI for people who refuse the terminal — still shells out to the real binary

**Angle:** Honest about being a wrapper; power users can still copy the full `croc …` command from the app.

---

### r/golang

**Title:** GUI for schollz/croc (Go) — Tauri desktop app for encrypted P2P file transfer

**Angle:** Croc is written in Go; this is a separate Tauri/Rust + React GUI that bundles upstream croc. Not a Go project itself — post only if the sub allows tangential tooling posts; otherwise skip.

---

### r/opensource (bonus)

**Title:** Croc GUI — MIT desktop app for encrypted peer-to-peer file transfer (Tauri + upstream croc)

---

## General title fallbacks

1. **Croc GUI — secure cross-platform file transfer for schollz/croc (encrypted P2P, drag-drop, QR, LAN)**
2. **[Release] Croc GUI: desktop app for encrypted file transfer — no cloud upload, no terminal**
3. **I built a GUI for croc — drag-and-drop encrypted file sharing on macOS, Windows, and Linux**

---

## Body (paste-ready)

**Suggested subs (pick 1–2, not all):** r/selfhosted · r/macapps · r/linux · r/commandline · r/opensource

**Images:** Upload `docs/images/banner-community.png` as the post image (Reddit prefers native uploads over hotlinked URLs).

---

### Post text

I built a desktop GUI for [croc](https://github.com/schollz/croc) — Zack Scholl's end-to-end encrypted, peer-to-peer file transfer tool. If you want secure file sharing **without uploading to the cloud** and **without living in the terminal**, this might be useful.

**What it is:** A free, cross-platform desktop app (Tauri 2 + React) for **macOS, Windows, and Linux** that bundles the croc binary. Encrypted transfers, relays, and code phrases are all upstream croc — this is a clear Send/Receive UI with drag-and-drop, QR codes, and LAN mode.

**Repo:** https://github.com/interfluve-wav/croc-gui

**Download:** https://github.com/interfluve-wav/croc-gui/releases (macOS `.dmg`, Windows `.msi`/`.exe`, Linux `.deb`/`.AppImage`)

**Features:**
- Send / Receive modes with live transfer status
- Code phrase display, copy phrase, copy full `croc …` command
- QR code for the phrase (handy for phone ↔ laptop)
- Drag-and-drop send; paste/drop receive codes
- Options: custom code, relay, port, overwrite, auto-confirm
- **Local-only** mode (`croc --local`) for LAN transfers without a public relay
- Zip on send (pack selection before transfer) and zip after receive
- SOCKS5 / HTTP proxy options
- Preferences for download folder and default relay

**Credits & disclaimer:**
- **croc** (transfer engine): [schollz/croc](https://github.com/schollz/croc) by Zack Scholl — please [sponsor schollz](https://github.com/sponsors/schollz) if you rely on croc
- **Croc GUI** (this desktop app): built by Suhaas / [interfluve-wav](https://github.com/interfluve-wav)
- This is **not** an official schollz project — an independent GUI wrapper. For protocol/CLI bugs, use [schollz/croc issues](https://github.com/schollz/croc/issues); for GUI/packaging, use [interfluve-wav/croc-gui issues](https://github.com/interfluve-wav/croc-gui/issues).

Feedback and issue reports welcome. MIT licensed.

---

## Comment FAQ (paste as replies when asked)

**Q: How is this different from just running `croc` in the terminal?**

Same transfer engine — the GUI bundles croc and shells out to it. You get drag-and-drop, QR codes, saved preferences, and a clearer Send/Receive flow. Power users can still copy the full CLI command from the app.

**Q: Is this official / affiliated with schollz?**

No. Independent open-source GUI by Suhaas / interfluve-wav. Please support upstream: [github.com/sponsors/schollz](https://github.com/sponsors/schollz).

**Q: Does it upload files to your servers?**

No. Transfers are peer-to-peer and encrypted via upstream croc. The GUI does not add a cloud backend.

**Q: Local / LAN only?**

Yes — enable local-only mode (`croc --local`) in options. Both sides need compatible settings; no public relay involved.

**Q: Why Tauri instead of Electron?**

Smaller binaries, native webview, Rust backend — good fit for a thin shell around a CLI binary.

**Q: Linux packages / Flatpak / AUR?**

`.deb` and AppImage on GitHub Releases today. Homebrew cask, winget, Flatpak are on the [roadmap](https://github.com/interfluve-wav/croc-gui/blob/main/docs/ROADMAP.md) — contributions welcome.

**Q: macOS notarization / Gatekeeper?**

Release builds are distributed unsigned initially; you may need to right-click → Open the first time. Signed/notarized releases are planned — track [Releases](https://github.com/interfluve-wav/croc-gui/releases).

**Q: Security / trust?**

MIT licensed, source on GitHub, CI builds from public workflow. Review `gui/src-tauri/` if you're cautious — it invokes the bundled croc binary with your chosen options.

---

## Reddit markdown image embeds (if sub allows)

```markdown
![Community banner](https://raw.githubusercontent.com/interfluve-wav/croc-gui/main/docs/images/banner-community.png)
![Hero](https://raw.githubusercontent.com/interfluve-wav/croc-gui/main/docs/images/banner-hero.png)
![Square](https://raw.githubusercontent.com/interfluve-wav/croc-gui/main/docs/images/banner-square.png)
```

**Prefer:** upload `banner-community.png` or `banner-square.png` directly as the post image.

---

## Posting etiquette

| Do | Don't |
|----|-------|
| Post to **1–2 relevant subs** max | Cross-post to every sub the same day |
| Disclose you're the author | Astroturf with alt accounts |
| Engage comments for 24–48h | Post and disappear |
| Link Releases with real binaries | Post before installers exist |
| Credit schollz / link sponsor page | Imply official croc affiliation |
