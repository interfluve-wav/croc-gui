# Upstream attribution

This document explains how **Croc GUI** relates to upstream **[schollz/croc](https://github.com/schollz/croc)**.

## Status

| | |
|---|---|
| **What Croc GUI is** | An **unofficial**, community-built **desktop GUI** around the upstream croc CLI |
| **What Croc GUI is not** | Not the official croc project, not affiliated with schollz, not endorsed unless schollz says so explicitly |
| **Transfer engine** | Protocol, crypto, relays, and CLI behavior come from **[schollz/croc](https://github.com/schollz/croc)** (MIT) |
| **This app** | **[interfluve-wav/croc-gui](https://github.com/interfluve-wav/croc-gui)** — GUI and packaging by **Suhaas / interfluve-wav** (MIT) |

We bundle upstream croc binaries and run them as a subprocess. We do not reimplement the croc protocol.

## Credits

| | |
|---|---|
| **croc** (transfer engine) | [schollz/croc](https://github.com/schollz/croc) by Zack Scholl — **[Sponsor schollz](https://github.com/sponsors/schollz)** |
| **Croc GUI** (this app) | **Suhaas** / [**interfluve-wav**](https://github.com/interfluve-wav) |

## Where to report issues

| Topic | Where |
|-------|--------|
| This GUI (UI, installers, packaging) | [croc-gui issues](https://github.com/interfluve-wav/croc-gui/issues) |
| croc protocol / CLI behavior | [schollz/croc issues](https://github.com/schollz/croc/issues) |

More: [`SUPPORT.md`](../SUPPORT.md).

## License

- **This GUI** is MIT — see [`LICENSE`](../LICENSE).
- **Upstream croc** is MIT (copyright Zack Scholl / contributors). Bundled binaries remain under upstream’s terms.
