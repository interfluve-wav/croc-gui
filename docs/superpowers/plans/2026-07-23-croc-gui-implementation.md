# Croc GUI Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Tauri + React desktop GUI under `gui/` that spawns a bundled `croc` binary for Send/Receive with common options.

**Architecture:** Fork/clone of schollz/croc; `gui/` Tauri app; Rust commands spawn/stream/kill bundled `croc`; React UI for Send/Receive + options.

**Tech Stack:** Tauri 2, Vite, React, TypeScript, Rust, Go `croc` binary as resource.

## Upstream Attribution

Wraps **[schollz/croc](https://github.com/schollz/croc)** by **Zack Scholl** — GUI only; protocol/CLI remain upstream. [Sponsor / support schollz](https://github.com/sponsors/schollz).

## Global Constraints

- Bundled `croc` only (no PATH fallback in v1)
- Platforms: macOS, Windows, Linux (local verify on macOS first)
- Options: custom phrase, relay, ports, overwrite/yes
- Spec: `docs/superpowers/specs/2026-07-23-croc-gui-design.md`

---

## File map

| Path | Responsibility |
|------|----------------|
| `gui/` | Tauri + Vite + React app root |
| `gui/src-tauri/src/lib.rs` | Commands: resolve binary, start/cancel, events |
| `gui/src-tauri/src/croc.rs` | Arg builder + process management |
| `gui/src/App.tsx` | Send/Receive UI shell |
| `gui/src-tauri/resources/bin/croc` | Bundled binary (dev/CI) |
| `.github/workflows/gui.yml` | Optional later: build croc + tauri |

---

### Task 1: Clone upstream into workspace

- [ ] Clone `schollz/croc` into workspace preserving existing `docs/`
- [ ] Keep remote origin; fork when `gh` auth works

### Task 2: Scaffold Tauri app in `gui/`

- [ ] Create Vite React-TS + Tauri 2 project under `gui/`
- [ ] Configure window title "Croc", resource dir for binary

### Task 3: Rust transfer layer

- [ ] `build_args(mode, options)` unit-tested
- [ ] `start_transfer` / `cancel_transfer` with stdout/stderr events
- [ ] Resolve bundled path + `CROC_BIN` for dev

### Task 4: React UI

- [ ] Send: file pick, options, phrase display, copy, progress log, cancel
- [ ] Receive: phrase, out dir, options, start/cancel
- [ ] Wire Tauri invoke + event listeners

### Task 5: Bundle + verify

- [ ] `go build` croc into `gui/src-tauri/resources/bin/croc`
- [ ] `cargo test` / UI typecheck / `tauri build` or `tauri dev` smoke
- [ ] Document run steps in `gui/README.md`
