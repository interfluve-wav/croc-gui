# Contributing

Thanks for helping improve **Croc GUI**.

## Scope

This repo is a **desktop GUI wrapper** around [schollz/croc](https://github.com/schollz/croc).

- **In scope:** UI, Tauri packaging, prefs, QR, zip-after-receive, CI, docs for this app.
- **Out of scope here:** croc protocol bugs, relay server changes, CLI flags that belong upstream — please open those on [schollz/croc](https://github.com/schollz/croc/issues).

## Dev setup

```bash
cd gui
npm install
npm run bundle:croc:download
npm run tauri:dev
```

See [`gui/README.md`](gui/README.md) for OS prerequisites and tests (`npm run test:rust`, `npm run build`).

## Pull requests

1. Keep changes focused; prefer small PRs.
2. Match existing TypeScript / Rust style in `gui/`.
3. Do not commit secrets, personal paths, or large binaries (`src-tauri/bin/croc*` is build-staged, not source of truth).
4. Credit upstream honestly; do not imply this project invented croc.

## Conduct

Be respectful. See [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Credits

- **croc:** [schollz](https://github.com/schollz/croc) — [Sponsor](https://github.com/sponsors/schollz)
- **Croc GUI:** [interfluve-wav](https://github.com/interfluve-wav)
