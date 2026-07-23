# Hacker News — Show HN

[Show HN](https://news.ycombinator.com/showhn.html) is for something **you made** that people can try. Post when Releases has installable binaries.

---

## Title (paste-ready)

Pick one:

1. **Show HN: Croc GUI – desktop app for encrypted P2P file transfer (croc, Tauri)**
2. **Show HN: A GUI for schollz/croc – drag-drop, QR, LAN mode, no cloud upload**
3. **Show HN: Croc GUI – cross-platform front end for croc file transfer**

HN titles are plain text — no markdown in the title field.

**URL:** `https://github.com/interfluve-wav/croc-gui`  
(or `https://github.com/interfluve-wav/croc-gui/releases` on release day)

---

## First comment (author perspective — post immediately after submit)

HN expects the submitter to leave a substantive first comment. Paste and adjust:

```
Hi HN — I'm Suhaas, author of Croc GUI.

I built this because I use schollz/croc constantly for ad-hoc encrypted file transfer, but friends and family won't touch a terminal. Croc GUI is a thin desktop wrapper (Tauri 2 + React) that bundles the upstream croc binary — same protocol, crypto, and relays, with a Send/Receive UI.

What it does:
- Drag-and-drop send, paste receive codes
- QR code + copy phrase / full `croc …` command
- Local-only LAN mode (--local)
- Zip on send, zip after receive, live progress
- SOCKS5/HTTP proxy, custom relay/port
- macOS, Windows, Linux installers on GitHub Releases

What it is NOT:
- Not an official schollz project — independent GUI by interfluve-wav
- Not a reimplementation of croc — it shells out to bundled croc
- Not a cloud service — peer-to-peer, end-to-end encrypted via upstream

Try it: https://github.com/interfluve-wav/croc-gui/releases
Source: https://github.com/interfluve-wav/croc-gui

If croc is valuable to you, please sponsor Zack Scholl: https://github.com/sponsors/schollz

Happy to answer questions on architecture, security model, packaging, or roadmap (relay profiles, history, Homebrew/winget are planned).
```

---

## Show HN etiquette

| Do | Don't |
|----|-------|
| Post **Tuesday–Thursday morning US Pacific** if possible | Launch Friday afternoon and disappear |
| Stay online **2–4 hours** to reply thoughtfully | Argue or get defensive |
| Answer technical questions with specifics | Marketing speak |
| Acknowledge limitations honestly | Oversell vs Dropbox/WeTransfer |
| Credit upstream croc prominently | Imply HN-famous affiliation |
| Link to Releases with binaries | Show HN a repo with no artifacts |

---

## If it gains traction

- Reply to every substantive comment — HN ranks engagement quality.
- If someone reports a bug, acknowledge and link the GitHub issue you open.
- Avoid editing the GitHub README mid-flight to change the headline — confuses early visitors.
- A single Show HN per major milestone (v0.1.0, v1.0) is enough — don't repost minor updates.

---

## Follow-up comment snippets

**On security model:**

```
The GUI doesn't implement crypto. It invokes the same croc binary you'd run from a shell, with user-selected flags (relay, --local, proxy, etc.). Review gui/src-tauri/src/ for the command construction. Threat model is largely upstream croc's threat model.
```

**On why not contribute GUI upstream:**

```
croc is intentionally CLI-first. This repo keeps GUI concerns separate so upstream stays focused. Happy to link prominently and funnel bugs that are clearly croc-core to schollz/croc.
```

**On Tauri vs native:**

```
Tauri keeps the bundle smaller than Electron and fits a "shell around a CLI" architecture. UI is React; heavy lifting is the bundled croc process.
```
