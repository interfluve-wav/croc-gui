# Security Policy

## Supported versions

Security fixes are applied to the latest release of **Croc GUI** on
[GitHub Releases](https://github.com/interfluve-wav/croc-gui/releases) and the
`main` branch when practical.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

1. Prefer a private GitHub Security Advisory on
   [interfluve-wav/croc-gui](https://github.com/interfluve-wav/croc-gui/security/advisories/new)
   if available.
2. Otherwise contact the maintainer via [interfluve-wav](https://github.com/interfluve-wav)
   or [suhaaschitturi.com](https://suhaaschitturi.com).

Include: affected OS/version, steps to reproduce, impact, and whether the issue
is in the **GUI wrapper** or likely in **upstream croc**.

## Upstream croc

Vulnerabilities in the croc protocol, crypto, or CLI should also be reported to
[schollz/croc](https://github.com/schollz/croc) following their process. This GUI
bundles their binary; we will coordinate when both projects are affected.

## Scope notes

- This app invokes a bundled `croc` binary and streams its output.
- Do not include secrets, private keys, or production credentials in reports or screenshots.
