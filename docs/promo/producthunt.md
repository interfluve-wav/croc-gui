# Product Hunt (future launch)

Draft copy for when you're ready for a PH launch — typically after v1.0 polish, screenshots in README, and stable signed/notarized builds. See [`docs/ROADMAP.md`](../ROADMAP.md) and [`docs/DISTRIBUTION.md`](../DISTRIBUTION.md).

---

## Tagline (60 chars max)

```
Desktop GUI for croc — encrypted file transfer, no terminal
```

**Alternates:**
- `Send files securely with croc — drag-drop, QR, LAN mode`
- `Cross-platform GUI for encrypted P2P file transfer`

---

## Description (260 chars max for short description field)

```
Croc GUI is a free desktop app for schollz/croc — encrypted peer-to-peer file transfer without cloud upload. Drag-and-drop, QR codes, local LAN mode, zip, and live progress on macOS, Windows, and Linux. Open source (MIT). Not affiliated with upstream croc.
```

---

## Long description (maker narrative)

```
Croc is the go-to CLI for secure, ad-hoc file sharing — end-to-end encrypted, peer-to-peer, no account required. But not everyone lives in a terminal.

Croc GUI wraps the real croc binary in a clean Send / Receive desktop app:

• Drag-and-drop files to send
• QR code + code phrase for phone ↔ laptop hand-off
• Local-only mode for LAN transfers without a public relay
• Zip on send, zip after receive
• Custom relay, port, proxy, and saved preferences
• Live transfer progress

Built with Tauri 2 for small native bundles on macOS, Windows, and Linux.

Important: Croc GUI is an independent open-source project by interfluve-wav — not an official schollz product. Please support upstream croc: github.com/sponsors/schollz

Download installers from GitHub Releases or build from source.
```

---

## Maker comment (first comment on launch day)

```
Hey Product Hunt 👋 — Suhaas here, maker of Croc GUI.

I use croc daily for encrypted transfers between my machines, but I kept onboarding friends with screenshots of terminal commands. This app is the GUI I wished existed: same croc security model, zero PATH setup.

What shipped:
- Bundled croc binary (no separate install)
- Send / Receive with QR, drag-drop, LAN mode
- Prebuilt macOS, Windows, Linux installers
- MIT licensed, CI-built from public repo

What's next (see roadmap on GitHub):
- Relay profiles and transfer history
- Homebrew cask, winget, Flatpak
- macOS notarization / Windows signing

I'd love feedback on UX and packaging for your OS. Issues and stars on GitHub mean a lot.

And if croc itself is valuable to you — please sponsor Zack Scholl: github.com/sponsors/schollz
```

---

## PH assets checklist

| Asset | Source |
|-------|--------|
| **Gallery image 1** | `docs/images/banner-hero.png` |
| **Gallery image 2** | `docs/images/banner-community.png` |
| **Gallery image 3** | `docs/images/send.png` (when captured) |
| **Thumbnail / logo** | `docs/images/logo.png` |
| **Website URL** | `https://github.com/interfluve-wav/croc-gui` |
| **Download link** | `https://github.com/interfluve-wav/croc-gui/releases` |

---

## Launch timing

- **Avoid** major PH launch days (big tech keynotes, holidays).
- Coordinate with a GitHub Release tag the same morning (US Pacific).
- Have maker + 2–3 friends ready to leave genuine comments in the first hour.
- Cross-post Twitter thread after PH goes live — don't lead with PH on HN the same day.
