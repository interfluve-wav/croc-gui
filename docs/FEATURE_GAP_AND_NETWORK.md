# Feature gap & network options (Croc GUI vs upstream croc)

Research note for **Croc GUI** ([interfluve-wav/croc-gui](https://github.com/interfluve-wav/croc-gui)) vs upstream **[schollz/croc](https://github.com/schollz/croc)**.

- **Local CLI surveyed:** `croc` v10.5.0 (`croc -h`, `croc send -h`, `croc relay -h`)
- **GUI surveyed:** `gui/src/App.tsx`, `gui/src-tauri/src/croc.rs` (TransferOptions / `build_args`)
- **Upstream docs:** [README](https://github.com/schollz/croc/blob/main/README.md)

This doc is research only. **Pass A (v0.2)** added relay password (`--pass`), SOCKS5/HTTP proxy fields (`--socks5`, `--connect`), and live transfer progress parsed from croc output.

---

## 1. Proxy / relay / local network path

Croc’s network behavior is entirely flag- and env-driven: SOCKS5/HTTP proxies, public or self-hosted relays, local-only mode, and known peer addresses. Overlay VPNs (if any) are outside the app — peers just need IP/hostname reachability so `--relay`, `--ip`, `--local`, and discovery work like on any LAN.

---

### Upstream network-related flags (v10.5.0)

| Flag / env | Scope | Role |
|------------|--------|------|
| `--socks5` / `$SOCKS5_PROXY` | Global + `send` | SOCKS5 proxy for outbound connections (README example: Tor `127.0.0.1:9050`). Defaults in help show placeholder URLs; empty / unset = no proxy in normal use. |
| `--connect` / `$HTTP_PROXY` | Global + `send` | HTTP proxy (CONNECT-style) for environments that only allow HTTP proxies. Documented less prominently than SOCKS5 in the README; added after [issue #270](https://github.com/schollz/croc/issues/270). |
| `--relay` / `$CROC_RELAY` | Global | Relay host:port (default public relay when unset). |
| `--relay6` / `$CROC_RELAY6` | Global | IPv6 relay address. |
| `--pass` / `$CROC_PASS` | Global | Relay password (default `pass123`; required for passworded self-hosted relays / Docker). |
| `--local` | Global | Force **local-only** connections (no public relay path). Both sides typically need compatible local discovery. |
| `--ip` | Global | Set sender IP if known, e.g. `10.0.0.1:9009` or `[::1]:9009` — useful when multicast discovery fails but you know the peer address. |
| `--no-local` | `send` | Disable the sender’s **ad-hoc local relay**; force use of the configured (usually remote) relay only. |
| `--multicast` | Global | Multicast address for local discovery (default `239.255.255.250`). |
| `--port` / `--transfers` | `send` / `relay` | Base port and number of transfer ports for multiplexing. |

**Also relevant (not proxy, but network UX):**

- Sender normally connects to the **public/configured relay** *and* may start a **local relay** so LAN peers can go direct; `--no-local` turns the latter off ([#141](https://github.com/schollz/croc/issues/141)).
- `--throttleUpload` (e.g. `500k`) limits upload rate.

CLI help defaults for `--socks5` / `--connect` look like always-on proxies; in practice they are optional and driven by flag or env (`$SOCKS5_PROXY`, `$HTTP_PROXY`). Flags work as `croc --socks5 … send …` or (newer) `croc send --socks5 …` ([PR #1053](https://github.com/schollz/croc/pull/1053)).

---

### Practical network patterns (community + CLI)

1. **Default public relay**  
   Both peers use the stock relay for room coordination; data may still try a direct / local path when discovery allows. Firewalls on the sender can block the ad-hoc local relay and force slower public-relay data.

2. **Known peer address + `--ip`**  
   Receiver (or both) use `--ip <host-or-ip>:9009` so discovery does not depend on LAN multicast — useful across LANs, VPNs, or any overlay where you already know the sender.

3. **Self-hosted relay**  
   Run `croc relay` on an always-on machine; both peers use `--relay <host>:9009` and matching `--pass`. Keeps coordination on your infrastructure without the public relay.

4. **`--local` on a shared LAN**  
   Force local-only transfers when multicast/discovery finds peers. Can fail with `found no addresses to connect` when discovery does not see the right interfaces ([#454](https://github.com/schollz/croc/issues/454)). Prefer `--ip` or a known `--relay` when `--local` is flaky.

5. **SOCKS5 / HTTP proxy egress**  
   Point croc at Tor or a corporate proxy with `--socks5` / `--connect` (or `$SOCKS5_PROXY` / `$HTTP_PROXY`) when outbound connectivity must go through a proxy — separate from choosing a relay or local path.

---

### How the GUI could expose this (tasteful Options UX)

Keep the main Send/Receive surface clean. Fold network extras into the existing **Options** accordion (and future “relay profiles” from the roadmap).

| Control | Maps to | Notes |
|---------|---------|--------|
| **SOCKS5 proxy** (optional text) | `--socks5` | Placeholder `socks5://127.0.0.1:9050`; remember in prefs if user opts in. |
| **HTTP proxy** (optional text) | `--connect` | Placeholder `http://127.0.0.1:8080`; mutually exclusive or “prefer SOCKS5 if both set” with a one-line hint. |
| **Relay password** | `--pass` | Next to existing Relay field; password field; needed for private relays. |
| **IPv6 relay** (advanced) | `--relay6` | Collapsed under “Advanced network”. |
| **Sender IP / peer address** | `--ip` | Advanced; help: “LAN or known IP of the sender, e.g. `10.0.0.1:9009`”. |
| **Disable local relay (send)** | `--no-local` | Checkbox for power users / firewalled senders. |

**Out of scope for v1 proxy UI:** Tor wizard, auto-detect proxies from system env (unless we explicitly inherit `$SOCKS5_PROXY` / `$HTTP_PROXY` when fields are empty).

---

## 2. Feature gap: upstream CLI vs current GUI

### What the GUI already exposes

From `TransferOptions` / Options panel / receive flow:

| Capability | How |
|------------|-----|
| Send / Receive | Modes + paths / code |
| Custom code phrase | `--code` (≥ 6 chars) |
| Relay host | `--relay` (persisted prefs) |
| Relay password | `--pass` (optional remember with relay) |
| SOCKS5 / HTTP proxy | `--socks5`, `--connect` (Advanced network; optional remember) |
| Live transfer progress | Parsed from croc stdout/stderr; progress bar + status |
| Send base port | `--port` |
| Auto-confirm | `--yes` |
| Overwrite | `--overwrite` |
| Local-only | `--local` |
| Zip before send | GUI stages selection → one `.zip` → `croc send` (not upstream `--zip`) |
| Zip after receive | GUI post-process (not a croc flag) |
| Output folder | `--out` |
| QR for receive phrase | **GUI** (`qrcode` lib) — not `croc send --qr` |
| Copy phrase / `croc …` command | Clipboard helpers |
| Drag-and-drop / paste code | UI only |
| Bundled croc binary | Tauri resource resolution |

### What upstream has that the GUI lacks

| Upstream feature | Flag(s) | GUI? | Priority |
|------------------|---------|------|----------|
| Relay password | `--pass` / `$CROC_PASS` | **Yes** (Options; optional remember with relay) |
| SOCKS5 proxy | `--socks5` / `$SOCKS5_PROXY` | **Yes** (Advanced network) |
| HTTP proxy | `--connect` / `$HTTP_PROXY` | **Yes** (Advanced network) |
| Disable local relay | `send --no-local` | No | **P1** — private relay / firewall clarity |
| Known sender IP | `--ip` | No | **P1** — broken multicast / known peer |
| IPv6 relay | `--relay6` | No | **P2** |
| Upload throttle | `--throttleUpload` | No | **P1** — shared links / metered |
| Send text / clipboard payload | `send --text` | No | **P1** — high GUI value, small surface |
| Respect `.gitignore` | `send --git` | No | **P1** — folder sends |
| Exclude patterns / paths | `--exclude`, `--exclude-file` | No | **P1** — folder sends |
| Hash algorithm | `send --hash` | No | **P2** |
| Encryption curve | `--curve` | No | **P2** |
| Transfer port count | `send --transfers` | No | **P2** |
| Multicast address | `--multicast` | No | **P2** |
| Classic mode | `--classic` | No | **P2** — Linux/macOS secret-in-argv; niche |
| Ask both sides | `--ask` | No | **P2** |
| Quiet / debug | `--quiet`, `--debug` | No (log pane shows stdout) | **P2** / debug-only |
| No compress | `--no-compress` | No | **P2** |
| Stdout receive | `--stdout` | No | **P2** — poor desktop fit |
| Ignore stdin | `--ignore-stdin` | No | **P2** |
| Clipboard toggles | `--disable-clipboard`, `--extended-clipboard` | Partial (GUI copies) | **P2** |
| Internal DNS | `--internal-dns` | No | **P2** |
| Remember settings | `--remember` | Partial (GUI prefs) | N/A |
| `croc send --qr` | CLI QR | GUI already has QR | Done (alternate impl) |
| `croc relay` UI | `relay` subcommand | No | **P2** — docs / external process OK first |
| Multiplexing off | `send --no-multi` | No | **P2** |

### Priority rationale (desktop GUI)

- **P0:** Unblocks real-world private relays and proxy egress without leaving the app.
- **P1:** Common power-user / privacy / bandwidth workflows; text send is a delightful GUI-native feature.
- **P2:** Crypto knobs, rare network edge cases, CLI scripting flags, or better served by docs + “copy CLI command”.

---

## 3. Recommendations (implementation later)

1. Extend `TransferOptions` + `build_args` with `pass`, `socks5`, `connect`, then `noLocal`, `ip`, `throttleUpload`, `text`, `git`, `exclude`.
2. Options UI: group **Connection** (relay, pass, local, no-local, ip) and **Proxy** (SOCKS5, HTTP) under Advanced; keep zip/overwrite/yes at top.
3. Short in-app help for relay / proxy / `--local` / `--ip` (link to this doc).
4. Align roadmap “relay profiles” with saved `{relay, pass, socks5?, connect?, local?, ip?}`.

---

## References

- Upstream README: <https://github.com/schollz/croc/blob/main/README.md>
- HTTP proxy history: <https://github.com/schollz/croc/issues/270>
- SOCKS5/connect on `send`: <https://github.com/schollz/croc/pull/1053>
- Local vs public relay / `--no-local`: <https://github.com/schollz/croc/issues/141>
- `--local` discovery failures: <https://github.com/schollz/croc/issues/454>
