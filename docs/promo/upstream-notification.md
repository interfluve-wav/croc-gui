# Upstream notification — paste-ready copy

Use these drafts to give **Zack Scholl (schollz)** a courteous heads-up about Croc GUI. This is **not** a feature request and **not** a request for endorsement.

**Before sending:** read [`docs/UPSTREAM_ATTRIBUTION.md`](../UPSTREAM_ATTRIBUTION.md).

| Channel | Status | Notes |
|---------|--------|-------|
| GitHub Discussions on schollz/croc | **Disabled** | Use an Issue |
| GitHub Issues | **Preferred** | One dedicated FYI issue |
| X (Twitter) | Optional | Tag **[@yakczar](https://twitter.com/yakczar)** once — not `@schollz` |

---

## 1. GitHub issue (schollz/croc)

**Where:** https://github.com/schollz/croc/issues/new

**Title:**

```
Community desktop GUI wrapper (unofficial) — FYI
```

**Body (paste-ready):**

```markdown
Hi Zack — quick courtesy heads-up, not a feature request.

I built an **unofficial** cross-platform **desktop GUI** for croc:

**https://github.com/interfluve-wav/croc-gui**

- **What it is:** Tauri 2 + React app that bundles and invokes the upstream `croc` binary (send/receive UI, drag-drop, QR, LAN/`--local`, zip helpers).
- **What it is not:** Not affiliated with you or the official croc project, and I'm **not** claiming endorsement. Happy to adjust naming, branding, or repo description if anything reads wrong to you.
- **License:** This GUI is MIT. Bundled croc binaries remain under upstream MIT terms; we credit schollz/croc in the README, About dialog, and docs.

If you ever want a "third-party desktop GUIs" section in the README (similar to the Android apps you already list), I'd be glad to open a small PR — no pressure. I saw [#1123](https://github.com/schollz/croc/issues/1123) re FlCroc; happy to contribute wording that lists community tools neutrally.

Otherwise, no action needed — just wanted you to know it exists. Thanks for croc; I use it constantly. If this message belongs somewhere else, feel free to close.

— Suhaas / interfluve-wav
```

**After posting:** do not bump the issue. If Zack replies, follow his preference on listing, naming, or silence.

---

## 2. X (Twitter) — optional one-time heads-up

**Tag:** [@yakczar](https://twitter.com/yakczar) (Zack’s public X handle)

**Do not** use `@schollz` on X — that is his GitHub username.

### Variant A — short (fits 280 chars with link)

```
Courtesy FYI @yakczar — I built an unofficial community desktop GUI for croc (Tauri, macOS/Win/Linux). Bundles upstream croc; not claiming endorsement. Happy to adjust anything.

https://github.com/interfluve-wav/croc-gui

(Sponsor: https://github.com/sponsors/schollz)
```

### Variant B — even shorter

```
Hi @yakczar — unofficial desktop GUI wrapper for croc, MIT, credits you + sponsor link throughout. FYI only, not asking for endorsement. Happy to tweak branding if needed.

https://github.com/interfluve-wav/croc-gui
```

**Rules:**

- Post **once**. Do not quote-tweet yourself repeatedly or reply under unrelated croc posts.
- Do not DM unless you already have an existing public professional relationship.

---

## 3. What NOT to say

Avoid phrasing that implies partnership or pressures upstream:

| ❌ Don't | ✅ Do instead |
|----------|----------------|
| "Official croc GUI is here" | "Unofficial community GUI for schollz/croc" |
| "Zack endorsed this" | "Not endorsed unless stated otherwise" |
| "Please add to README or star us" | "Happy to open a neutral third-party PR if you want" |
| "croc needed a GUI — I fixed it" | "I wanted a desktop UI around the existing CLI" |
| Multiple @-mentions across issues/PRs | One FYI issue + optional one tweet |
| Feature request disguised as FYI | Separate titles; FYI issue is courtesy only |

---

## 4. Optional: helpful reply on #896

Only if someone **actively asks** for GUI alternatives in [schollz/croc#896](https://github.com/schollz/croc/issues/896):

```markdown
For a cross-platform **desktop** GUI (macOS/Windows/Linux), there's a community Tauri wrapper: https://github.com/interfluve-wav/croc-gui — unofficial, bundles upstream croc. Android options are already in the README.
```

Do not post this unless the thread is live and relevant.

---

## 5. Recommended order for you (maintainer)

1. **Commit** attribution docs and README updates in this repo (done when this file lands).
2. **Open** the GitHub issue above on schollz/croc (you, manually — do not automate).
3. **Wait** a few days; if no objection and you still want X visibility, post **one** tweet tagging @yakczar.
4. **Never** add "endorsed by schollz" unless he says so explicitly in a reply you can link.

---

## Links to keep handy

| Resource | URL |
|----------|-----|
| Upstream croc | https://github.com/schollz/croc |
| Sponsor schollz | https://github.com/sponsors/schollz |
| This GUI | https://github.com/interfluve-wav/croc-gui |
| Attribution guide | https://github.com/interfluve-wav/croc-gui/blob/main/docs/UPSTREAM_ATTRIBUTION.md |
