# Distribution playbook

How to launch **Croc GUI** beyond "push code to GitHub." A repo alone is necessary but not sufficient — people discover tools through releases, README first impressions, and targeted posts with real binaries.

Paste-ready copy: [`docs/promo/`](promo/) · Brand assets: [`docs/images/`](images/)

---

## Is a new GitHub repo enough?

**No.** A public repo is the foundation, not the launch.

| What a repo gives you | What it does *not* do |
|-----------------------|------------------------|
| Source of truth, issues, stars | Put installers in users' hands |
| CI badges and credibility | Reach people who don't watch GitHub |
| README for link previews | Replace community trust on Reddit/HN |
| Long-term SEO (slow) | Drive day-one downloads |

**Minimum bar before promoting:** tagged **Release with binaries**, polished **README** (hero image, features, credits), working **CI**, clear **license** and **upstream credits**, and an **issue tracker** you will actually monitor.

---

## Minimum viable launch checklist

- [ ] **README** — hero banner, what/who/credits, download CTA, screenshots or architecture diagram
- [ ] **GitHub Release** — `v0.1.0` (or current) with macOS `.dmg`, Windows installer, Linux `.deb`/AppImage
- [ ] **CI** — [`.github/workflows/build-gui.yml`](../.github/workflows/build-gui.yml) green on `main`
- [ ] **LICENSE** — MIT for GUI; upstream croc credited
- [ ] **Credits** — schollz / croc + sponsor link; GUI by interfluve-wav; **not official**
- [ ] **Issue tracker** — templates optional; respond within ~48h during launch week
- [ ] **SUPPORT.md** — where GUI vs upstream bugs go

---

## GitHub repo polish

### Topics (repo Settings → Topics)

Suggested: `croc`, `file-transfer`, `tauri`, `desktop-app`, `cross-platform`, `encryption`, `peer-to-peer`, `rust`, `react`, `macos`, `windows`, `linux`, `open-source`

### Description (short, under repo name)

```
Desktop GUI for schollz/croc — secure encrypted P2P file transfer. Drag-drop, QR, LAN mode. macOS, Windows, Linux.
```

### Social preview

GitHub does not use custom `og:image` tags from README files. The **first large image in the README** (`docs/images/banner-hero.png`) is what most link previews pick up when someone pastes the repo URL. Keep the hero at the top.

### Releases ≠ just the repo

Promote **`/releases`** URLs when you want downloads. A star on the repo is great; a user with an installer is better.

---

## Platform playbook

### Twitter / X

| Item | Guidance |
|------|----------|
| **Copy** | [`docs/promo/twitter.md`](promo/twitter.md) |
| **Image** | `banner-square.png` on every root tweet |
| **Timing** | Tue–Thu, morning in primary audience TZ |
| **Thread** | 5–7 tweets; pin main tweet 1–2 weeks |
| **Community** | Reply respectfully where people discuss croc — don't mass-@ schollz |
| **CTA** | Star repo + download Releases |

### Reddit

| Item | Guidance |
|------|----------|
| **Copy** | [`docs/promo/reddit.md`](promo/reddit.md) |
| **Subs** | r/selfhosted, r/macapps, r/linux, r/commandline — **pick 1–2**, not all |
| **Rules** | Read each sub's self-promo rules; many require disclosure |
| **Transparency** | State you're the author; **not official croc** |
| **Image** | Upload `banner-community.png` natively |
| **FAQ** | Keep comment FAQ handy — engage 24–48h |

### Hacker News

| Item | Guidance |
|------|----------|
| **Copy** | [`docs/promo/hackernews.md`](promo/hackernews.md) |
| **Format** | **Show HN:** title + GitHub URL |
| **First comment** | Post author context immediately (architecture, limitations, credits) |
| **Timing** | Tue–Thu morning US Pacific; stay online 2–4h |
| **Frequency** | Once per major milestone — not every patch |

### Mastodon / LinkedIn / dev.to / Product Hunt

| Platform | Doc |
|----------|-----|
| Mastodon | [`docs/promo/mastodon.md`](promo/mastodon.md) |
| LinkedIn | [`docs/promo/linkedin.md`](promo/linkedin.md) |
| dev.to | [`docs/promo/devto.md`](promo/devto.md) |
| Product Hunt (later) | [`docs/promo/producthunt.md`](promo/producthunt.md) |

---

## Package managers (later)

Not required for v0.1.0 launch. Track demand and add when stable signing/notarization is sorted.

| Channel | Status | Notes |
|---------|--------|-------|
| **Homebrew cask** | Roadmap | See [`docs/ROADMAP.md`](ROADMAP.md) — "Screenshot & release polish" |
| **winget** | Roadmap | Windows signed builds help acceptance |
| **Flatpak / Flathub** | Roadmap | Linux packaging variant if demand |
| **AUR** | Community | Often user-maintained after traction |

Until then, **GitHub Releases is the canonical download.**

---

## Do / Don't

### Do

- **Engage issues** — triage, label, fix showstoppers quickly during launch week
- **Screenshots / GIF** in README when captured (`send.png`, `receive.png`)
- **Star upstream** [schollz/croc](https://github.com/schollz/croc) and mention [sponsor schollz](https://github.com/sponsors/schollz)
- **Credit clearly** — GUI by interfluve-wav; engine by schollz
- **Ship binaries first** — then post
- **One thoughtful post per community** — quality over spray

### Don't

- **Claim official affiliation** with schollz or croc project
- **Spam every subreddit** the same day
- **Post without release artifacts** — "coming soon" posts waste goodwill
- **Astroturf** — alt accounts, fake reviews
- **Neglect upstream** — croc bugs go to schollz/croc issues

---

## Order of operations

Recommended sequence for **v0.1.0** launch:

```
1. Release v0.1.0 with macOS .dmg (+ Win/Linux if CI artifacts ready)
      ↓
2. README polish — hero, features, download CTA, credits, images
      ↓
3. GitHub metadata — description, topics, verify social preview
      ↓
4. Twitter/X — main tweet + thread, pin, image attached
      ↓
5. Reddit — pick 1–2 subs (e.g. r/selfhosted + r/macapps OR r/linux)
      ↓
6. Hacker News Show HN — optional, same week or after first feedback wave
      ↓
7. Mastodon / LinkedIn / dev.to — as bandwidth allows
      ↓
8. Product Hunt — defer until v1.0 polish, screenshots, signing
```

**Spacing:** Stagger Reddit and HN by at least 24–48h unless you have capacity for two comment threads at once.

---

## Measuring success (realistic v0.1.0)

| Signal | Healthy early sign |
|--------|-------------------|
| GitHub stars | Steady trickle, not viral spike |
| Release downloads | Non-zero across ≥2 platforms |
| Issues | Actionable bug reports (means people tried it) |
| Upstream goodwill | No complaints from croc community about affiliation |

Stars are vanity; **downloads + retained users + upstream respect** are the goal.

---

## Quick links

| Resource | URL |
|----------|-----|
| Repo | https://github.com/interfluve-wav/croc-gui |
| Releases | https://github.com/interfluve-wav/croc-gui/releases |
| Sponsor upstream | https://github.com/sponsors/schollz |
| Upstream croc | https://github.com/schollz/croc |
| Promo copy | [`docs/promo/`](promo/) |
| Roadmap | [`docs/ROADMAP.md`](ROADMAP.md) |
