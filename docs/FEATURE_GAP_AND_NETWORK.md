# Feature gap & network options (Croc GUI vs upstream croc)

Research note for **Croc GUI** ([interfluve-wav/croc-gui](https://github.com/interfluve-wav/croc-gui)) vs upstream **[schollz/croc](https://github.com/schollz/croc)**.

- **Local CLI surveyed:** `croc` v10.5.0 (`croc -h`, `croc send -h`, `croc relay -h`)
- **GUI surveyed:** `gui/src/App.tsx`, `gui/src-tauri/src/croc.rs` (TransferOptions / `build_args`)
- **Upstream docs:** [README](https://github.com/schollz/croc/blob/main/README.md); community discussion of Tailscale in [schollz/croc#441](https://github.com/schollz/croc/issues/441)

This doc is research only. Proxy / Tailscale UI is **not** implemented here.

---

## 1. Proxy / Tailscale / network path

### Clarification: Tailscale is not a croc feature

Croc has **no Tailscale SDK**, MagicDNS API, or VPN integration. Tailscale (or WireGuard, ZeroTier, etc.) is a **network path**: if both peers (and optionally a self-hosted relay) are reachable on that overlay, croc’s existing `--relay`, `--ip`, `--local`, and discovery flags work like they would on any LAN.

**Preferred GUI UX wording:** “Transfers over your Tailscale (or other VPN) network” — meaning use Tailscale IPs / MagicDNS hostnames with croc flags — **not** “embed Tailscale” or ship a Tailscale client inside the app.

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
| `--ip` | Global | Set sender IP if known, e.g. `10.0.0.1:9009` or `[::1]:9009` — useful when multicast discovery fails but you know the peer address (including Tailscale IPs). |
| `--no-local` | `send` | Disable the sender’s **ad-hoc local relay**; force use of the configured (usually remote) relay only. |
| `--multicast` | Global | Multicast address for local discovery (default `239.255.255.250`). |
| `--port` / `--transfers` | `send` / `relay` | Base port and number of transfer ports for multiplexing. |

**Also relevant (not proxy, but network UX):**

- Sender normally connects to the **public/configured relay** *and* may start a **local relay** so LAN peers can go direct; `--no-local` turns the latter off ([#141](https://github.com/schollz/croc/issues/141)).
- `--throttleUpload` (e.g. `500k`) limits upload rate.

CLI help defaults for `--socks5` / `--connect` look like always-on proxies; in practice they are optional and driven by flag or env (`$SOCKS5_PROXY`, `$HTTP_PROXY`). Flags work as `croc --socks5 … send …` or (newer) `croc send --socks5 …` ([PR #1053](https://github.com/schollz/croc/pull/1053)).

---

### Practical Tailscale patterns (community + CLI)

There is no official “croc + Tailscale” guide. Patterns that match how croc works:

1. **Same tailnet, default croc**  
   Both machines on Tailscale. Often the public relay still staples the room, then peers may attempt direct paths. Firewall rules on the sender can block the ad-hoc local relay and force slower public-relay data ([#441](https://github.com/schollz/croc/issues/441)).

2. **Direct via Tailscale IP + `--ip`**  
   Receiver (or both) use `--ip <tailscale-ip>:9009` (or MagicDNS name if it resolves for croc) so discovery does not depend on LAN multicast. Reported to get near-line-rate over Tailscale when firewalls allow peer ports ([#441](https://github.com/schollz/croc/issues/441)).

3. **Self-hosted relay on a Tailscale node**  
   Run `croc relay` on a always-on machine; both peers use `--relay <tailscale-ip-or-magicdns>:9009` and matching `--pass`. Keeps coordination on your overlay without exposing the public relay.

4. **`--local` on a Tailscale “LAN”**  
   Treat the tailnet like a LAN. Can work when discovery finds peers; can fail with `found no addresses to connect` when multicast/discovery does not see Tailscale interfaces ([#454](https://github.com/schollz/croc/issues/454)). Prefer `--ip` or a known `--relay` on the tailnet when `--local` is flaky.

5. **SOCKS5 / HTTP via Tailscale userspace proxies**  
   Separate from “use Tailscale as the path”: Tailscale’s userspace mode can expose SOCKS5/HTTP proxies (`tailscaled --socks5-server=…`). Point croc at those with `--socks5` / `--connect` only when you need proxy egress *through* Tailscale (containers, restricted hosts)—not the usual desktop “both on Tailscale” case.

**Do not recommend:** embedding Tailscale SDK, spawning `tailscaled`, or marketing Tailscale as a first-class croc mode.

---

### How the GUI could expose this (tasteful Options UX)

Keep the main Send/Receive surface clean. Fold network extras into the existing **Options** accordion (and future “relay profiles” from the roadmap).

| Control | Maps to | Notes |
|---------|---------|--------|
| **SOCKS5 proxy** (optional text) | `--socks5` | Placeholder `socks5://127.0.0.1:9050`; remember in prefs if user opts in. |
| **HTTP proxy** (optional text) | `--connect` | Placeholder `http://127.0.0.1:8080`; mutually exclusive or “prefer SOCKS5 if both set” with a one-line hint. |
| **Relay password** | `--pass` | Next to existing Relay field; password field; needed for private relays. |
| **IPv6 relay** (advanced) | `--relay6` | Collapsed under “Advanced network”. |
| **Sender IP / peer address** | `--ip` | Advanced; help: “Tailscale or LAN IP of the sender, e.g. `100.x.y.z:9009`”. |
| **Disable local relay (send)** | `--no-local` | Checkbox for power users / firewalled senders. |
| **“Use Tailscale address” helper** (optional) | Fills `--ip` or Relay | **Not** an SDK: short copy + text field for `100.x` / MagicDNS; link to Tailscale docs. Label: “Transfers over your VPN / Tailscale network”. |

**Out of scope for v1 proxy UI:** Tor wizard, auto-detect proxies from system env (unless we explicitly inherit `$SOCKS5_PROXY` / `$HTTP_PROXY` when fields are empty), embedding Tailscale.

---

## 2. Feature gap: upstream CLI vs current GUI

### What the GUI already exposes

From `TransferOptions` / Options panel / receive flow:

| Capability | How |
|------------|-----|
| Send / Receive | Modes + paths / code |
| Custom code phrase | `--code` (≥ 6 chars) |
| Relay host | `--relay` (persisted prefs) |
| Send base port | `--port` |
| Auto-confirm | `--yes` |
| Overwrite | `--overwrite` |
| Local-only | `--local` |
| Zip before send | `send --zip` |
| Zip after receive | GUI post-process (not a croc flag) |
| Output folder | `--out` |
| QR for receive phrase | **GUI** (`qrcode` lib) — not `croc send --qr` |
| Copy phrase / `croc …` command | Clipboard helpers |
| Drag-and-drop / paste code | UI only |
| Bundled croc binary | Tauri resource resolution |

### What upstream has that the GUI lacks

| Upstream feature | Flag(s) | GUI? | Priority |
|------------------|---------|------|----------|
| Relay password | `--pass` / `$CROC_PASS` | No | **P0** — self-hosted / Docker relays need it |
| SOCKS5 proxy | `--socks5` / `$SOCKS5_PROXY` | No | **P0** — Tor / restricted nets / Tailscale userspace |
| HTTP proxy | `--connect` / `$HTTP_PROXY` | No | **P1** — corporate nets |
| Disable local relay | `send --no-local` | No | **P1** — private relay / firewall clarity |
| Known sender IP | `--ip` | No | **P1** — Tailscale / broken multicast |
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
- **P1:** Common power-user / privacy / bandwidth / Tailscale workflows; text send is a delightful GUI-native feature.
- **P2:** Crypto knobs, rare network edge cases, CLI scripting flags, or better served by docs + “copy CLI command”.

---

## 3. Recommendations (implementation later)

1. Extend `TransferOptions` + `build_args` with `pass`, `socks5`, `connect`, then `noLocal`, `ip`, `throttleUpload`, `text`, `git`, `exclude`.
2. Options UI: group **Connection** (relay, pass, local, no-local, ip) and **Proxy** (SOCKS5, HTTP) under Advanced; keep zip/overwrite/yes at top.
3. Document Tailscale as **network path** in in-app help (short paragraph + link to this doc).
4. Align roadmap “relay profiles” with saved `{relay, pass, socks5?, connect?, local?, ip?}`.
5. Do **not** embed Tailscale; optional helper only fills `--ip` / relay from user-entered `100.x` / MagicDNS.

---

## References

- Upstream README: <https://github.com/schollz/croc/blob/main/README.md>
- HTTP proxy history: <https://github.com/schollz/croc/issues/270>
- SOCKS5/connect on `send`: <https://github.com/schollz/croc/pull/1053>
- Local vs public relay / `--no-local`: <https://github.com/schollz/croc/issues/141>
- Tailscale + `--ip` performance anecdote: <https://github.com/schollz/croc/issues/441>
- `--local` discovery failures: <https://github.com/schollz/croc/issues/454>
- Tailscale userspace SOCKS5/HTTP (for proxy-through-tailnet only): <https://tailscale.com/docs/concepts/userspace-networking>
