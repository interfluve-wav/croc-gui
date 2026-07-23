# Twitter / X promo

Paste-ready copy for launch posts. **Attach an image** — Twitter/X heavily favors posts with media.

---

## Main tweet (paste-ready)

**Attach:** `docs/images/screenshots/send-main.png` (real app window — best for launch) or `docs/images/banner-square.png` (1:1 brand card) or `docs/images/banner-community.png` (feature bullets)

```
Croc GUI — secure cross-platform file transfer without the terminal.

✓ Encrypted peer-to-peer (no cloud upload)
✓ Drag-and-drop send
✓ QR codes + copy phrase
✓ Local-only LAN mode
✓ Zip, progress, proxy options
✓ macOS · Windows · Linux

https://github.com/interfluve-wav/croc-gui

Powered by @schollz's croc — sponsor: https://github.com/sponsors/schollz
GUI by Suhaas / @interfluve_wav (not an official croc project)
```

**Note:** With line breaks as shown, this exceeds 280 chars. Use as a thread opener or the short variants below for a single tweet.

---

## Short single tweets (under 280 chars)

### Variant A — feature-forward

**Attach:** `docs/images/banner-square.png`

```
Croc GUI — desktop app for @schollz's croc. Encrypted P2P file transfer, drag-drop, QR codes, LAN mode. macOS/Win/Linux.

https://github.com/interfluve-wav/croc-gui

GUI by @interfluve_wav · sponsor croc: github.com/sponsors/schollz
```

### Variant B — problem/solution

**Attach:** `docs/images/banner-square.png`

```
Need to send files securely without Dropbox or the terminal?

Croc GUI wraps @schollz's croc — encrypted P2P, drag-drop, QR, LAN mode.

https://github.com/interfluve-wav/croc-gui
```

### Variant C — release day

**Attach:** `docs/images/banner-community.png`

```
v0.1.0: Croc GUI is out — a desktop app for encrypted file transfer with croc.

Prebuilt installers for macOS, Windows, Linux. Open source (MIT).

https://github.com/interfluve-wav/croc-gui/releases
```

### Variant D — link-only (no image)

```
Croc GUI — open-source desktop front end for @schollz/croc. No cloud upload, no terminal. https://github.com/interfluve-wav/croc-gui
```

---

## Thread (7 tweets — reply chain)

Post **Tweet 1** as the root with `banner-square.png` attached. Reply to yourself for each subsequent tweet.

**Tweet 1 — hook**

```
Croc GUI — secure cross-platform file transfer without the terminal.

Encrypted P2P via @schollz's croc. Drag-drop, QR codes, LAN mode. macOS / Windows / Linux.

https://github.com/interfluve-wav/croc-gui

🧵 what it is + why I built it
```

**Tweet 2 — what it is**

```
What is it?

A Tauri 2 + React desktop app that bundles the croc binary. Same end-to-end encrypted transfers — just a clear Send / Receive UI instead of memorizing CLI flags.

Free, open source (MIT). Prebuilt installers on GitHub Releases.
```

**Tweet 3 — who it's for**

```
Who it's for:

• Devs who love croc but want a GUI for daily use
• Friends/family who won't touch a terminal
• Anyone sending files between Mac, Windows, Linux, or phone (via QR phrase)

No account. No cloud upload. Files go peer-to-peer.
```

**Tweet 4 — features**

```
Highlights:

• Code phrase + QR for hand-off to phone / second machine
• Drag-and-drop send; paste receive codes
• Local-only (--local) for LAN peers, no public relay
• Zip on send / after receive
• Live progress, custom relay, port, proxy options
• Remembers download folder + default relay
```

**Tweet 5 — how it relates to croc**

```
Important: this is NOT an official @schollz project.

Croc GUI is an independent wrapper by Suhaas / interfluve-wav. Transfer engine, crypto, and protocol are 100% upstream croc.

If croc saves you time, please sponsor Zack: https://github.com/sponsors/schollz
```

**Tweet 6 — try it**

```
Try it:

1. Download for your OS → https://github.com/interfluve-wav/croc-gui/releases
2. Open → Send or Receive
3. Share the code phrase or QR

Build from source: clone repo, `cd gui`, `npm install`, `npm run tauri:dev`
```

**Tweet 7 — CTA**

```
Feedback welcome — issues on the repo:

https://github.com/interfluve-wav/croc-gui/issues

⭐ Star if useful · 🔁 share with someone still emailing zip files

Roadmap: relay profiles, history, packaging (Homebrew/winget) → see docs/ROADMAP.md
```

---

## After posting

| Action | Why |
|--------|-----|
| **Pin** the main tweet to your profile for 1–2 weeks | New visitors see the launch |
| **Reply** (don't @-spam) to relevant croc threads if someone asks for a GUI | Community discovery, respectful |
| **Quote-tweet** your own thread after a few days with `docs/images/screenshots/send-main.png` | Second chance in timeline |
| **Post Tue–Thu, 9am–12pm** in your primary audience timezone | Rough peak for dev tools |

---

## Image attachment notes

| Asset | When to use |
|-------|-------------|
| `screenshots/send-main.png` | **Best for launch** — real Send tab window capture |
| `screenshots/options-expanded.png` | Follow-up tweet showing relay / local-only / zip options |
| `banner-square.png` | **Default brand card** — best Twitter/X timeline crop (1:1) |
| `banner-community.png` | Feature-focused post; release announcements |
| `banner-hero.png` | Wide card; pair with link preview from GitHub README |
| `banner-minimal.png` | Follow-up tweet if you want a lighter visual |
| `logo.png` | Too small alone — use inside a composed graphic only |

**Tips:**
- Always attach an image on the root tweet — text-only dev-tool posts underperform.
- GitHub link previews may pick up `banner-hero.png` from the README; attached image still wins in timeline.
- Add alt text: *"Croc GUI — secure cross-platform file transfer desktop app for schollz/croc"*

---

## Hashtags (optional, 1–2 max)

Twitter hashtags matter less than they used to. If you use any:

`#opensource` · `#filetransfer` · `#selfhosted` · `#macOS` · `#Linux`

Avoid `#croc` unless you're sure it won't collide with unrelated content.
