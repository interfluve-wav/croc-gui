# Roadmap

Ambitious but realistic directions for **Croc GUI**. Upstream [croc](https://github.com/schollz/croc) remains the transfer engine; this roadmap is about the desktop experience around it.

Priorities shift with feedback. Open an [issue](https://github.com/interfluve-wav/croc-gui/issues) if something below should move up.

Research on upstream CLI coverage, proxies, and relays: [`FEATURE_GAP_AND_NETWORK.md`](FEATURE_GAP_AND_NETWORK.md).

## Next up

Near-term work that builds on what already shipped (Send/Receive, QR, drag-drop, local-only, zip, prefs, About, CI).

1. ~~**Transfer progress that reads like a product**~~ — **Done (Pass A):** parse croc output for percent, bytes, speed; progress bar + phase status; raw log retained.
2. **Local transfer history** — Recent codes, paths, and outcomes (local-only; no cloud). Quick “reuse last receive folder / last relay.”
3. **Screenshot & release polish** — Capture Send/Receive shots for the README; tag GitHub Releases from CI artifacts; notarization / signing notes for macOS and Windows.
4. **Relay profiles** — Named presets (default public relay, home LAN, self-hosted) instead of retyping host/port each time. Build on existing relay + pass + proxy fields from Pass A.
5. **QR that encodes `croc <phrase>`** — Full command in the code so phone scanners and docs stay consistent.

## Later

Larger bets once the core loop feels finished.

### Deeper transfer UX

- Multi-file queue (enqueue while one transfer runs)
- Pause/cancel semantics aligned with upstream capabilities
- Richer failure recovery (retry with same code / options)
- Optional “open containing folder” and “reveal in Finder/Explorer” after receive (partially started via opener plugin)

### Trust & privacy

- First-class private / self-hosted relay setup guides
- Clearer local-only UX (network hints, “both sides must enable --local”)
- Optional code verification / checksum display when croc exposes it
- Explicit “what leaves your machine” copy in About / help

### Platform integration

- Finder / Explorer “Share with Croc” (or drag target / service)
- System tray + “receive standing by”
- Deep links (`croc-gui://receive?code=…`)
- Tauri updater channel with signed releases
- Better Linux packaging variants (Flatpak) if demand appears

### Power user

- Saved option profiles (zip + local + relay bundles)
- SOCKS5 / HTTP proxy fields (`--socks5`, `--connect`) and known peer `--ip` — proxy fields shipped in Pass A; `--ip` still open — see [`FEATURE_GAP_AND_NETWORK.md`](FEATURE_GAP_AND_NETWORK.md)
- Bandwidth throttle (`--throttleUpload`)
- Send short text / clipboard payloads via croc’s `--text`
- Folder-send polish: `--git`, `--exclude` / `--exclude-file`
- Companion CLI or scripting hooks that call the same bundled binary
- Export / import prefs as JSON

### Collaboration

- Named “pair devices” (remember peer-friendly defaults, not accounts)
- Saved peers as labels over codes/relays (still phrase-based; no central identity)

### Accessibility & i18n

- Full keyboard paths and screen-reader labels for Send/Receive/Options
- High-contrast / larger type preferences
- Localization (start with en + one additional locale)

## Out of scope (for now)

- Replacing or forking the croc protocol
- Cloud accounts, sync backends, or social features
- Claiming to be an official schollz product (we are an independent GUI; please sponsor upstream)

## Credits

- **croc:** [schollz](https://github.com/schollz/croc) — [Sponsor](https://github.com/sponsors/schollz)
- **Croc GUI:** [Suhaas / interfluve-wav](https://github.com/interfluve-wav/croc-gui)
