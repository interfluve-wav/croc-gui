# Maintainer docs (local only)

Consumer-facing docs live in the root [`README.md`](../README.md), [`SUPPORT.md`](../SUPPORT.md), and [`UPSTREAM_ATTRIBUTION.md`](UPSTREAM_ATTRIBUTION.md).

**Promo copy, roadmap, feature-gap notes, design specs, and screenshot capture scripts** are kept **on your machine only** (gitignored). They are not published to the public repo.

## Restore on this machine or after a fresh clone

```bash
./scripts/restore-maintainer-docs.sh
```

That pulls files from git history (`0c77231` by default). Override the snapshot: `./scripts/restore-maintainer-docs.sh <commit>`.

## What you get locally

| Path | Contents |
|------|----------|
| `docs/promo/` | Twitter, Reddit, HN, LinkedIn, etc. |
| `docs/ROADMAP.md` | Product roadmap |
| `docs/FEATURE_GAP_AND_NETWORK.md` | CLI vs GUI gaps, proxies, relays |
| `docs/DISTRIBUTION.md` | Launch / distribution playbook |
| `docs/superpowers/` | Design spec and implementation plan |
| `scripts/capture-*.sh` | macOS screenshot helpers |
| `gui/scripts/capture-web.mjs` | Playwright capture via `?capture=` dev mode |
