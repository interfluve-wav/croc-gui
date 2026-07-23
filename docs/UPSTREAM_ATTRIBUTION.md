# Upstream attribution & community transparency

This document explains how **Croc GUI** relates to upstream **[schollz/croc](https://github.com/schollz/croc)**, how to credit Zack Scholl (schollz) correctly, and how maintainers should communicate with upstream without implying endorsement.

## Status (read this first)

| | |
|---|---|
| **What Croc GUI is** | An **unofficial**, community-built **desktop GUI wrapper** around the upstream croc CLI |
| **What Croc GUI is not** | Not the official croc project, not affiliated with schollz, not endorsed unless schollz says so explicitly |
| **Transfer engine** | Protocol, crypto, relays, and CLI behavior come from **[schollz/croc](https://github.com/schollz/croc)** (MIT) |
| **This repo** | **[interfluve-wav/croc-gui](https://github.com/interfluve-wav/croc-gui)** — GUI, packaging, and Tauri app by **Suhaas / interfluve-wav** (MIT) |

We bundle upstream croc binaries and invoke them as a subprocess. We do not reimplement the croc protocol.

## Upstream facts (research snapshot)

Researched from [schollz/croc](https://github.com/schollz/croc) as of 2026-07:

- **License:** MIT (copyright Zack Scholl / contributors, 2017–2025). See upstream [`LICENSE`](https://github.com/schollz/croc/blob/main/LICENSE).
- **CONTRIBUTING.md:** none published.
- **GitHub Discussions:** **disabled** — courtesy heads-ups belong in **Issues**, not Discussions.
- **Sponsor page:** [github.com/sponsors/schollz](https://github.com/sponsors/schollz) (linked prominently in upstream README).
- **Related / third-party GUIs:** upstream README lists **Android** clients (`crocgui`, `croc-app`). Desktop community GUIs are discussed in issues (e.g. [#896](https://github.com/schollz/croc/issues/896), [#972](https://github.com/schollz/croc/issues/972)); [#1123](https://github.com/schollz/croc/issues/1123) is an open request to add another third-party GUI (FlCroc) to the README.
- **Contact:** GitHub [@schollz](https://github.com/schollz); blog [schollz.com](https://schollz.com). Public X/Twitter handle is **[@yakczar](https://twitter.com/yakczar)** (per Zack’s public pages — not `@schollz` on X).

## How to credit in this repo

### README (required)

Keep these elements visible near the top of [`README.md`](../README.md):

1. **Unofficial community project** — plain language, not buried in footnotes.
2. **Powered by** link to [schollz/croc](https://github.com/schollz/croc).
3. **GUI by** Suhaas / [interfluve-wav](https://github.com/interfluve-wav).
4. **Sponsor upstream** link to [github.com/sponsors/schollz](https://github.com/sponsors/schollz).
5. **No endorsement** unless schollz explicitly grants it in writing.

### In-app (About dialog)

The Tauri About screen should continue to show dual attribution (GUI maintainer + upstream croc + sponsor link). Do not use upstream croc branding as if this app were an official schollz release.

### Promo & distribution

All public posts should include:

- “Unofficial community GUI” (or equivalent)
- Link to upstream croc + sponsor page
- Link to this GUI repo

See [`docs/promo/`](promo/) and [`docs/DISTRIBUTION.md`](DISTRIBUTION.md).

## Tagging schollz — do’s and don’ts

### GitHub

| Do | Don’t |
|----|-------|
| Link to [schollz/croc](https://github.com/schollz/croc) in README, About, and promo | `@schollz` on every issue or PR in **this** repo (unnecessary) |
| File **one** polite upstream issue as a courtesy FYI (see below) | Open feature requests on upstream asking them to adopt or endorse your GUI |
| Offer a small README PR listing third-party desktop GUIs **if** upstream wants that section | Spam multiple issues, or comment on unrelated threads with launch links |
| Route croc protocol/CLI bugs to [schollz/croc issues](https://github.com/schollz/croc/issues) | Imply partnership or official status in upstream threads |

**Note:** Upstream Discussions are off. Use a single **Issue** for the heads-up.

### X (Twitter)

| Do | Don’t |
|----|-------|
| **One** respectful post tagging **[@yakczar](https://twitter.com/yakczar)** with repo link | Repeated “check out my project” mentions |
| State clearly: unofficial community GUI, happy to adjust branding | Tag on unrelated croc threads or reply chains |
| Include [sponsor schollz](https://github.com/sponsors/schollz) | Claim endorsement or co-branding |

`@schollz` is the **GitHub** username; on X the public handle is **@yakczar**.

### Sponsor link

Always surface [github.com/sponsors/schollz](https://github.com/sponsors/schollz) wherever you mention croc. Upstream README states the project depends on community support — sponsoring is the highest-signal way users can thank Zack.

## MIT compliance (bundled croc)

Upstream croc is MIT. When distributing binaries built from this repo:

1. Retain upstream copyright and license notice (see repo [`LICENSE`](../LICENSE) and packaging notes).
2. Do not remove or obscure that the transfer engine is schollz/croc.
3. Do not relicense upstream croc as something other than MIT.

This GUI’s MIT license covers **our** source; bundled croc remains under upstream terms.

## Letting schollz know (recommended order)

Use paste-ready copy in [`docs/promo/upstream-notification.md`](promo/upstream-notification.md).

1. **GitHub Issue on schollz/croc** (preferred)  
   Title something like: `Community desktop GUI wrapper (unofficial) — FYI`  
   Brief courtesy note: link to this repo, MIT compliance, not asking for endorsement, happy to adjust naming/branding, optional offer to help with a “third-party desktop GUIs” README section via PR.

2. **Optional: one X post** tagging [@yakczar](https://twitter.com/yakczar)  
   Short, respectful heads-up — not a marketing blast.

3. **Do not** update README or promo to say “official” or “endorsed” until schollz explicitly says so.

### Should you comment on existing issues instead?

- **[#1123](https://github.com/schollz/croc/issues/1123)** — about adding FlCroc to the README; only comment if you are offering a **combined** third-party GUI list PR, not to piggyback a launch.
- **[#896](https://github.com/schollz/croc/issues/896)** — “GUI alternatives”; a **single** helpful reply pointing to this repo *may* be appropriate if someone is actively asking for a desktop GUI, but do not necro-post without context.
- **Default:** open a **new, dedicated FYI issue** so the message is easy to find and dismiss if unwanted.

## Wording templates

**Short (badge / tagline):**

> Unofficial community GUI for [schollz/croc](https://github.com/schollz/croc) — not affiliated with or endorsed by Zack Scholl unless stated otherwise.

**Medium (README blurb):**

> Croc GUI is a free, open-source desktop app by Suhaas / interfluve-wav. It wraps the upstream croc CLI (by Zack Scholl) with a Send/Receive UI. Please [sponsor schollz](https://github.com/sponsors/schollz) if you rely on croc.

**What never to say:**

- “Official croc GUI” / “from the croc team”
- “Partnership with schollz” / “endorsed by Zack Scholl” (without proof)
- “The GUI croc always needed” in upstream issue titles (reads like spam)

## Maintainer checklist

- [ ] README shows **Unofficial community project** near the top
- [ ] Sponsor badge links to [github.com/sponsors/schollz](https://github.com/sponsors/schollz)
- [ ] About dialog credits upstream + sponsor
- [ ] Promo copy says unofficial + links upstream
- [ ] One upstream FYI issue filed (or consciously deferred)
- [ ] No endorsement language anywhere unless schollz approves

## Related docs

- [`docs/promo/upstream-notification.md`](promo/upstream-notification.md) — paste-ready GitHub issue and X message
- [`SUPPORT.md`](../SUPPORT.md) — where GUI vs upstream bugs go
- [`docs/DISTRIBUTION.md`](DISTRIBUTION.md) — launch ethics and anti-spam guidance
