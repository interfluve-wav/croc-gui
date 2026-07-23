# Reddit promo

## Title options

1. **Croc GUI — cross-platform desktop app for schollz/croc (drag-drop, QR, local-only, zip)**
2. **[Release] Croc GUI: a Tauri desktop front end for secure file transfer with croc**
3. **I built a GUI for croc — send/receive files without the terminal (macOS, Windows, Linux)**

---

## Body (paste-ready)

**Suggested subreddits:** r/selfhosted · r/linux · r/macapps · r/opensource · r/commandline (check each sub's self-promo rules)

**Images to upload or link:**

- Primary: `docs/images/banner-community.png` (feature bullets)
- Alternate: `docs/images/banner-hero.png` or `docs/images/banner-square.png`
- In-repo paths for markdown embeds on GitHub:

```markdown
![Croc GUI banner](https://raw.githubusercontent.com/interfluve-wav/croc-gui/main/docs/images/banner-community.png)
```

---

### Post text

I put together a desktop GUI for [croc](https://github.com/schollz/croc) — Zack Scholl's end-to-end encrypted, ad-hoc file transfer tool. If you already use croc from the CLI but want a clearer Send/Receive workflow (or you're helping someone who doesn't live in a terminal), this might be useful.

**What it is:** A cross-platform app (Tauri 2 + React) that bundles the croc binary and shells out to it. It does **not** reimplement the protocol — relays, crypto, and codes are all upstream croc.

**Repo:** https://github.com/interfluve-wav/croc-gui

**Features:**
- Send / Receive modes with live transfer status
- Code phrase display, copy phrase, copy full `croc …` command
- QR code for the phrase (handy for phone ↔ laptop)
- Drag-and-drop send; paste/drop receive codes
- Options: custom code, relay, port, overwrite, auto-confirm
- **Local-only** mode (`croc --local`) for LAN transfers without a public relay
- Zip on send (pack selection before transfer) and zip after receive
- Preferences for download folder and default relay

**Install:**
- Prebuilt installers: [GitHub Releases](https://github.com/interfluve-wav/croc-gui/releases) (macOS `.dmg`, Windows `.msi`/`.exe`, Linux `.deb`/`.AppImage`)
- Build from source: `cd gui && npm install && npm run bundle:croc:download && npm run tauri:build` (Node 20+, Rust stable; see repo README for platform deps)

**Screenshots / branding in repo:**

| Image | Path |
|-------|------|
| Hero banner | `docs/images/banner-hero.png` |
| Community banner | `docs/images/banner-community.png` |
| Square social | `docs/images/banner-square.png` |
| Logo | `docs/images/logo.png` |

![Croc GUI — community banner](https://raw.githubusercontent.com/interfluve-wav/croc-gui/main/docs/images/banner-community.png)

**Credits & disclaimer:**
- **croc** (transfer engine): [schollz/croc](https://github.com/schollz/croc) by Zack Scholl — please [sponsor schollz](https://github.com/sponsors/schollz) if you rely on croc
- **Croc GUI** (this desktop app): built by Suhaas / [interfluve-wav](https://github.com/interfluve-wav)
- This is **not** an official schollz project — an independent GUI wrapper. For protocol/CLI bugs, use [schollz/croc issues](https://github.com/schollz/croc/issues); for GUI/packaging, use [interfluve-wav/croc-gui issues](https://github.com/interfluve-wav/croc-gui/issues).

Feedback and issue reports welcome. MIT licensed.

---

## Reddit markdown image embeds (raw GitHub URLs)

```markdown
![Hero](https://raw.githubusercontent.com/interfluve-wav/croc-gui/main/docs/images/banner-hero.png)
![Square](https://raw.githubusercontent.com/interfluve-wav/croc-gui/main/docs/images/banner-square.png)
![Logo](https://raw.githubusercontent.com/interfluve-wav/croc-gui/main/docs/images/logo.png)
```

Reddit image posts: upload `banner-community.png` or `banner-square.png` directly; link the repo in a top-level comment if the sub requires it.
