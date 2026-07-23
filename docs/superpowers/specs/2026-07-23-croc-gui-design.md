# Croc GUI Design

**Date:** 2026-07-23  
**Status:** Approved for implementation (2026-07-23)  
**Product:** Desktop GUI for [schollz/croc](https://github.com/schollz/croc) (secure file transfer via code phrase)

## Goal

Ship a simple, cross-platform desktop app that wraps the existing `croc` CLI so users can send and receive files without using the terminal. v1 includes Send, Receive, and a small set of common options.

## Decisions (locked)

| Topic | Choice |
|--------|--------|
| App type | Desktop |
| Shell | Tauri |
| Frontend | Vite + React |
| Integration | Spawn bundled `croc` binary; parse stdout/stderr |
| Platforms (v1) | macOS, Windows, Linux |
| Feature scope | Send + Receive + options (not full CLI parity) |
| Repo strategy | Fork `schollz/croc`; add GUI under `gui/` |

## Architecture

```
┌─────────────────────────────────────────┐
│  Tauri window (React UI)                │
│  Send | Receive | Options | Status      │
└─────────────────┬───────────────────────┘
                  │ invoke / events
┌─────────────────▼───────────────────────┐
│  Rust (Tauri commands)                  │
│  - resolve bundled croc path            │
│  - spawn / kill process                 │
│  - stream stdout/stderr lines           │
│  - map options → CLI args               │
└─────────────────┬───────────────────────┘
                  │ exec
┌─────────────────▼───────────────────────┐
│  Bundled croc binary (per OS/arch)      │
│  resources/bin/croc[.exe]               │
└─────────────────────────────────────────┘
```

### Repository layout (after fork)

- Upstream Go CLI remains at repo root (unchanged behavior).
- New `gui/` directory holds the Tauri project:
  - `gui/src/` — React UI
  - `gui/src-tauri/` — Rust commands, packaging config
  - `gui/src-tauri/resources/bin/` — platform `croc` binaries (CI-filled; not committed as large blobs if avoidable — prefer CI artifact copy at build time)
- CI workflow(s) build `croc` for each target and run `tauri build` with the matching binary in resources.

### Why spawn CLI (not reimplement)

- Reuses proven transfer/crypto/relay logic.
- Stays compatible with upstream `croc` releases via rebase/merge.
- Faster path to a trustworthy MVP than embedding or reimplementing the protocol.

## UI & flows

One window. Two primary modes (tabs or segmented control). Options collapsed by default. Utility tone — clear hierarchy, one job per screen; not a marketing landing page.

### Send

1. User adds files/folders (drop zone + file picker).
2. Optionally expands Options: custom code phrase, relay address, ports, overwrite / “yes to all”.
3. User clicks **Start**.
4. UI shows code phrase prominently + **Copy**; progress; short status log; **Cancel**.

### Receive

1. User pastes/enters code phrase.
2. User chooses download folder (default: OS downloads or last-used path).
3. Same Options panel as Send where applicable.
4. User clicks **Start** → progress, success/fail, affordance to open folder; **Cancel** while running.

### Shared UX rules

- Only one transfer at a time; **Start** disabled while running.
- **Cancel** kills the child `croc` process.
- Status log shows the last N lines from `croc` (readable feedback, not a full terminal emulator).
- Errors surface as a clear banner/message plus the relevant log lines.

## Options → CLI mapping

Exact flags must match the forked `croc` version’s help text at implementation time. Intended mapping for v1:

| UI option | Behavior |
|-----------|----------|
| Custom code phrase | Pass phrase to send (or equivalent `--code` / positional per current CLI) |
| Relay address | `--relay` (or current equivalent) |
| Ports | `--ports` (or current equivalent) |
| Overwrite / yes to all | `--yes` / overwrite flags as supported |
| Receive output dir | `--out` or cwd set to chosen folder (prefer explicit flag if available) |

Unsupported advanced flags (curve, proxy, local-only, multicast, etc.) are out of scope for v1.

## Data flow

1. UI collects paths + options → `start_transfer` Tauri command with a structured payload (`mode: send|receive`, paths, phrase, options).
2. Rust resolves `croc` via Tauri resource path (dev: env/`CROC_BIN` or sibling build artifact; prod: bundled resource).
3. Rust spawns process with piped stdout/stderr; emits line events to the frontend (`transfer://stdout`, `transfer://stderr`, `transfer://exit`).
4. Frontend updates phrase detection (regex/heuristic on known croc output), progress if parseable, and log.
5. On exit code 0 → success state; non-zero → error state with last log lines.
6. `cancel_transfer` sends kill to the child process group/process.

Phrase display: prefer parsing the line croc prints for the share code; if send was started with a user-supplied phrase, show that phrase immediately as well.

## Error handling

| Case | Handling |
|------|----------|
| Bundled binary missing | Block Start; message to reinstall / rebuild |
| Spawn failure | Error banner + hint (permissions, arch mismatch) |
| Invalid/empty paths or empty phrase on receive | Client-side validation before invoke |
| Transfer fail (nonzero exit) | Error state + log |
| Cancel | Clean kill; UI returns to idle with “Cancelled” |
| Concurrent Start | Reject second start in Rust; UI already disables |

Do not silently fall back to system PATH `croc` in v1 (bundled-only, per product decision).

## Packaging & CI

- Targets: macOS (Apple Silicon + Intel as Tauri allows), Windows (x64), Linux (x64 AppImage/deb as Tauri default allows).
- Pipeline sketch:
  1. Build `croc` Go binary for the job’s OS/arch.
  2. Place binary at `gui/src-tauri/resources/bin/croc` (`.exe` on Windows).
  3. `npm`/`pnpm` install + `tauri build` in `gui/`.
  4. Upload installers as CI artifacts / GitHub Releases.
- Local dev: document building `croc` once and pointing resources or `CROC_BIN` at it.

## Testing

- **Unit (Rust):** arg builder from options payload; path resolution helpers.
- **Unit (UI):** form validation; phrase copy state; disabled Start while running.
- **Manual / smoke:** send file between two local app instances (or app ↔ CLI) on each OS before release.
- **No** automated full P2P E2E in CI for v1 (relay/network flaky); optional later.

## Out of scope (v1)

- Full CLI flag parity
- System-PATH fallback
- Multiple concurrent transfers
- Tray icon / background receive daemon
- Auto-update channel (can add later via Tauri updater)
- Reimplementing the croc protocol in Rust

## Success criteria

- User can send files and see a copyable code phrase without Terminal.
- User can receive via pasted phrase into a chosen folder.
- Options for relay, ports, custom phrase, and overwrite work when set.
- App ships with a working bundled `croc` on macOS, Windows, and Linux installers.
- Upstream Go CLI remains usable from the same fork.

## Upstream Attribution

This GUI wraps **[schollz/croc](https://github.com/schollz/croc)** by **Zack Scholl**. The transfer protocol and CLI are upstream; this project does not reimplement or claim authorship of croc. Support the author: [Sponsor / support schollz](https://github.com/sponsors/schollz). Upstream croc is MIT-licensed.

## Implementation gate

1. User approves this spec.
2. Write implementation plan (`docs/superpowers/plans/...`).
3. Then: fix GitHub auth if needed → fork → scaffold `gui/` → implement → package.
